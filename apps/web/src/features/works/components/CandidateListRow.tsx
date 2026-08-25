import { Group, Stack, Text, Title } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import { ActionRow, AppBadge } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
  isPreviewOrManualCandidate,
} from './quick-add-helpers';
import { getWorkTypeLabel } from '../utils/work-options';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface CandidateListRowProps {
  active: boolean;
  candidate: ImportCandidate;
  duplicateCount: number;
  onSelect: () => void;
}

export function CandidateListRow({
  active,
  candidate,
  duplicateCount,
  onSelect,
}: CandidateListRowProps) {
  const { t } = useAppTranslation();
  const sourceCoverage = getCandidateSourceCoverage(candidate);
  const isManualCandidate = isPreviewOrManualCandidate(candidate);
  const hasArchiveMatch =
    duplicateCount > 0 || Boolean(candidate.existingRecord);
  const yearLabel =
    candidate.releaseYear !== null && candidate.releaseYear !== undefined
      ? String(candidate.releaseYear)
      : candidate.countLabel;

  return (
    <button
      aria-label={t('works.add.search.candidateSelectAria', {
        title: candidate.title,
        type: getWorkTypeLabel(candidate.type),
      })}
      aria-pressed={active}
      className={cn(css.candidateRow)}
      data-active={active ? 'true' : 'false'}
      onClick={onSelect}
      type="button"
    >
      <Group align="center" gap="md" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="row"
        />

        <Stack flex={1} gap={6} miw={0}>
          <div>
            <Title className={cn(css.candidateRowTitle)} order={4}>
              {candidate.title}
            </Title>
            <Text
              className={cn(css.candidateRowContributor)}
              lineClamp={1}
              size="sm"
            >
              {getCandidateContributorText(candidate)}
            </Text>
          </div>

          <ActionRow>
            <Text c="var(--app-text-muted)" size="xs">
              {[
                getWorkTypeLabel(candidate.mediumType),
                yearLabel,
                candidate.formatLabel,
                isManualCandidate
                  ? t('works.add.search.manualRecord')
                  : sourceCoverage.providerCountLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {hasArchiveMatch && (
              <AppBadge tone="warning">
                {duplicateCount > 0
                  ? t('works.add.search.similarRecordsCount', {
                      count: duplicateCount,
                    })
                  : t('works.add.search.possibleExisting')}
              </AppBadge>
            )}
          </ActionRow>

          {hasArchiveMatch && (
            <Text className={cn(css.candidateRowWarning)} fw={700} size="xs">
              {t('works.add.search.checkExistingBeforeSave')}
            </Text>
          )}
        </Stack>
        <span aria-hidden="true" className={cn(css.candidateSelectionMark)}>
          {active ? '✓' : '›'}
        </span>
      </Group>
    </button>
  );
}
