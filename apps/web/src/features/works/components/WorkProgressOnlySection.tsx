import {
  canUseProgressUnitForWorkType,
  getDefaultProgressUnitForWorkType,
  isProgressOnlyWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
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
      onError(t('works.record.progressOnly.unsupported'));

      return;
    }

    if (
      nextValues.progressCurrent !== null &&
      nextValues.progressTotal !== null &&
      nextValues.progressCurrent > nextValues.progressTotal
    ) {
      onError(t('works.record.progressOnly.invalidRange'));

      return;
    }

    try {
      onError(null);
      await worksService.updateProgress(work.id, nextValues);
      onSuccess(t('works.record.progressOnly.saved'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('works.record.progressOnly.saveError'),
      );
    }
  }

  return (
    <PageSection
      eyebrow={t('works.detail.progress')}
      title={t('works.record.progressOnly.title', {
        type: getWorkTypeLabel(work.type),
      })}
    >
      <QuickProgressControl onSave={handleSave} work={work} />
    </PageSection>
  );
}
