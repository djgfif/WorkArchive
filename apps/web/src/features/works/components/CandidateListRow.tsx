import { Group, Stack, Text, Title } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import { ActionRow, AppBadge } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
  hasWikidataSource,
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
  const wikidataIncluded = hasWikidataSource(candidate);
  const hasArchiveMatch =
    duplicateCount > 0 || Boolean(candidate.existingRecord);
  const positiveScoreReasons = isManualCandidate
    ? []
    : (candidate.scoreBreakdown
        ?.filter((entry) => entry.weight > 0)
        .slice(0, 2) ?? []);
  const visibleAliases = candidate.titleAliases
    ?.filter((titleAlias) => titleAlias !== candidate.title)
    .slice(0, 2);
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
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="row"
        />

        <Stack flex={1} gap={7} miw={0}>
          <ActionRow justify="space-between">
            <Group gap={6} wrap="wrap">
              <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
              {yearLabel && <AppBadge tone="muted">{yearLabel}</AppBadge>}
            </Group>
            {hasArchiveMatch ? (
              <AppBadge tone="warning">
                {t('works.add.search.archiveReviewNeeded')}
              </AppBadge>
            ) : isManualCandidate ? (
              <AppBadge tone="accent">
                {t('works.add.search.manualCandidate')}
              </AppBadge>
            ) : (
              <AppBadge tone="success">{candidate.confidenceLabel}</AppBadge>
            )}
          </ActionRow>

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
            <AppBadge tone="muted">
              {isManualCandidate
                ? t('works.add.search.manualRecord')
                : candidate.sourceLabel}
            </AppBadge>
            {!isManualCandidate && (
              <AppBadge tone="muted">
                {sourceCoverage.providerCountLabel}
              </AppBadge>
            )}
            {!isManualCandidate && wikidataIncluded && (
              <AppBadge tone="accent">
                {candidate.sourceId === 'wikidata'
                  ? t('works.add.search.wikidataIncluded')
                  : t('works.add.search.wikidataEnhanced')}
              </AppBadge>
            )}
            {!isManualCandidate && (
              <AppBadge tone="muted">{candidate.formatLabel}</AppBadge>
            )}
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

          {!isManualCandidate && positiveScoreReasons.length > 0 && (
            <ActionRow>
              {positiveScoreReasons.map((entry) => (
                <AppBadge key={`${candidate.id}:${entry.label}`} tone="success">
                  {entry.label}
                </AppBadge>
              ))}
            </ActionRow>
          )}

          {visibleAliases && visibleAliases.length > 0 && (
            <Text className={cn(css.candidateRowAlias)} lineClamp={1} size="xs">
              {t('works.add.search.aliasPrefix', {
                aliases: visibleAliases.join(' · '),
              })}
            </Text>
          )}
        </Stack>
      </Group>
    </button>
  );
}
