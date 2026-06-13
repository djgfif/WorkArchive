import { Accordion, Stack } from '@mantine/core';
import {
  isVolumeRecordableWorkType,
  type UserReleaseRecord,
  type WorkRecord,
} from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();

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
      description={t('works.record.release.description')}
      eyebrow={t('works.record.release.eyebrow')}
      title={t('works.record.release.title')}
    >
      <Accordion variant="separated">
        <Accordion.Item value="volume-records">
          <Accordion.Control>
            {t('works.record.release.control')}
          </Accordion.Control>
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
