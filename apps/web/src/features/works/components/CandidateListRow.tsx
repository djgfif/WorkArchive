import { Group, Stack, Text, Title } from '@mantine/core';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import { ActionRow, AppBadge } from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports/services/imports.service';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
  isPreviewOrManualCandidate,
} from './quick-add-helpers';
import { getWorkTypeLabel } from '../utils/work-options';

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
  const positiveScoreReasons = isManualCandidate
    ? []
    : (candidate.scoreBreakdown
        ?.filter((entry) => entry.weight > 0)
        .slice(0, 2) ?? []);
  const visibleAliases = candidate.titleAliases
    ?.filter((titleAlias) => titleAlias !== candidate.title)
    .slice(0, 2);

  return (
    <button
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
      aria-pressed={active}
      onClick={onSelect}
      style={{
        background: active
          ? 'linear-gradient(180deg, var(--app-surface-1), var(--app-surface-low))'
          : 'var(--app-surface-0)',
        border: active
          ? '1px solid var(--app-border-strong)'
          : '1px solid var(--app-border-color)',
        borderRadius: 'var(--app-surface-radius)',
        boxShadow: active ? 'var(--app-focus-border)' : 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: '0.75rem',
        textAlign: 'left',
        transition: 'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
        width: '100%',
      }}
      type="button"
    >
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="row"
        />

        <Stack flex={1} gap={6} miw={0}>
          <ActionRow justify="space-between">
            <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
            {isManualCandidate ? (
              <AppBadge tone="accent">직접 추가 후보</AppBadge>
            ) : (
              <AppBadge tone="success">{candidate.confidenceLabel}</AppBadge>
            )}
          </ActionRow>

          <div>
            <Title order={4}>{candidate.title}</Title>
            <Text c="var(--app-text-muted)" lineClamp={1} size="sm">
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
            {duplicateCount > 0 && (
              <AppBadge tone="warning">비슷한 기록 {duplicateCount}</AppBadge>
            )}
          </ActionRow>

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
            <Text c="var(--app-text-muted)" lineClamp={1} size="xs">
              별칭 {visibleAliases.join(' · ')}
            </Text>
          )}
        </Stack>
      </Group>
    </button>
  );
}
