import {
  canUseProgressUnitForWorkType,
  getDefaultProgressUnitForWorkType,
  isProgressOnlyWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

import { PageSection } from '@shared/components/AppPrimitives';
import { QuickProgressControl } from './ArchiveComponents';
import { worksService } from '../services/works.service';
import { getWorkTypeLabel } from '../utils/work-options';

interface ProgressOnlySectionProps {
  onError(message: string | null): void;
  onSuccess(message: string): void;
  work: WorkRecord;
}

export function ProgressOnlySection({
  onError,
  onSuccess,
  work,
}: ProgressOnlySectionProps) {
  const defaultUnit = getDefaultProgressUnitForWorkType(work.type);
  if (!isProgressOnlyWorkType(work.type) || defaultUnit === null) {
    return null;
  }
  const progressUnit = defaultUnit;

  async function handleSave(nextValues: {
    lastConsumedLabel: string;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: ProgressUnit;
  }) {
    if (!canUseProgressUnitForWorkType(work.type, progressUnit)) {
      onError('이 작품 유형에는 진행도 기록을 사용할 수 없습니다.');

      return;
    }

    if (
      nextValues.progressCurrent !== null &&
      nextValues.progressTotal !== null &&
      nextValues.progressCurrent > nextValues.progressTotal
    ) {
      onError('현재 진행도가 전체 진행도보다 클 수 없습니다.');

      return;
    }

    try {
      onError(null);
      await worksService.updateProgress(work.id, nextValues);
      onSuccess('진행도를 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '진행도를 저장하지 못했습니다.',
      );
    }
  }

  return (
    <PageSection
      eyebrow="진행 기록"
      title={`${getWorkTypeLabel(work.type)} 진행 기록`}
    >
      <QuickProgressControl onSave={handleSave} work={work} />
    </PageSection>
  );
}
