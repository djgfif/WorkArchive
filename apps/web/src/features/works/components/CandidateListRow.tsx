import { Group, Stack, Text, Title } from '@mantine/core';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import { ActionRow, AppBadge } from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
  hasWikidataSource,
  isPreviewOrManualCandidate,
} from './quick-add-helpers';
import { getWorkTypeLabel } from '../utils/work-options';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

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
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
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
              <AppBadge tone="warning">내 아카이브 확인 필요</AppBadge>
            ) : isManualCandidate ? (
              <AppBadge tone="accent">직접 추가 후보</AppBadge>
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
                ? '입력한 제목으로 직접 기록'
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
                  ? 'Wikidata 출처 포함'
                  : 'Wikidata 보강'}
              </AppBadge>
            )}
            {!isManualCandidate && (
              <AppBadge tone="muted">{candidate.formatLabel}</AppBadge>
            )}
            {hasArchiveMatch && (
              <AppBadge tone="warning">
                {duplicateCount > 0
                  ? `비슷한 기록 ${duplicateCount}개`
                  : '이미 저장된 기록 가능성'}
              </AppBadge>
            )}
          </ActionRow>

          {hasArchiveMatch && (
            <Text
              className={cn(css.candidateRowWarning)}
              fw={700}
              size="xs"
            >
              저장 전에 기존 기록과 같은 작품인지 확인하세요.
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
            <Text
              className={cn(css.candidateRowAlias)}
              lineClamp={1}
              size="xs"
            >
              별칭 {visibleAliases.join(' · ')}
            </Text>
          )}
        </Stack>
      </Group>
    </button>
  );
}
