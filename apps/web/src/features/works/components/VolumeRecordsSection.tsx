import { Accordion, Stack } from '@mantine/core';
import {
  isVolumeRecordableWorkType,
  type UserReleaseRecord,
  type WorkRecord,
} from '@work-archive/shared-types';

import { PageSection } from '@shared/components/AppPrimitives';
import type { UserRecordReleasesResponse } from '../services/user-records.api';
import { WorkReleaseRecordRow } from './WorkReleaseRecordRow';

interface VolumeRecordsSectionProps {
  localRecords: UserReleaseRecord[];
  onError(message: string | null): void;
  onSuccess(message: string): void;
  releaseData: UserRecordReleasesResponse | null;
  work: WorkRecord;
}

export function VolumeRecordsSection({
  localRecords,
  onError,
  onSuccess,
  releaseData,
  work,
}: VolumeRecordsSectionProps) {
  if (!isVolumeRecordableWorkType(work.type) || !releaseData) {
    return null;
  }

  if (
    !releaseData.policy.releaseRecordsSupported ||
    releaseData.releases.length === 0
  ) {
    return null;
  }

  const localByReleaseId = new Map(
    localRecords.map((record) => [record.catalogReleaseId, record]),
  );

  return (
    <PageSection
      description="작품 등록은 항상 title-level로 유지하고, 권별 기록은 필요할 때만 접어서 남깁니다."
      eyebrow="선택 기록"
      title="권별 기록"
    >
      <Accordion variant="separated">
        <Accordion.Item value="volume-records">
          <Accordion.Control>권별 별점과 짧은 감상 남기기</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              {releaseData.releases.map((release) => (
                <WorkReleaseRecordRow
                  key={release.id}
                  onError={onError}
                  onSuccess={onSuccess}
                  record={
                    localByReleaseId.get(release.id) ??
                    release.userReleaseRecord
                  }
                  release={release}
                  workId={work.id}
                />
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </PageSection>
  );
}
