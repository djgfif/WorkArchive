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
  const yearLabel =
    candidate.releaseYear !== null && candidate.releaseYear !== undefined
      ? String(candidate.releaseYear)
      : candidate.countLabel;

  return (
    <button
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
      aria-pressed={active}
      onClick={onSelect}
      style={{
        /* ── 배경 / 테두리 ── */
        background: active
          ? 'var(--app-surface-card)'
          : 'var(--app-surface-subtle)',
        border: `1px solid ${active ? 'var(--app-accent-primary)' : 'var(--app-border-subtle)'}`,
        borderRadius: 'var(--mantine-radius-lg)',

        /* ── 활성 포커스 링 ── */
        boxShadow: active
          ? 'var(--wa-shadow-glow), var(--wa-shadow-card)'
          : 'none',

        /* ── 텍스트 / 레이아웃 ── */
        color: 'var(--app-text-primary)',
        cursor: 'pointer',
        padding: '0.875rem',
        textAlign: 'left',
        width: '100%',

        /* ── 전환 ── */
        transition: [
          'background var(--wa-motion-fast, 150ms) var(--wa-ease-spring)',
          'border-color var(--wa-motion-fast, 150ms) var(--wa-ease-spring)',
          'box-shadow var(--wa-motion-normal, 240ms) var(--wa-ease-spring)',
          'transform var(--wa-motion-fast, 150ms) var(--wa-ease-spring)',
        ].join(', '),
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-card)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border-default)';
        }
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-subtle)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border-subtle)';
        }
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
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

        <Stack flex={1} gap={7} miw={0}>
          <ActionRow justify="space-between">
            <Group gap={6} wrap="wrap">
              <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
              {yearLabel && <AppBadge tone="muted">{yearLabel}</AppBadge>}
            </Group>
            {isManualCandidate ? (
              <AppBadge tone="accent">직접 추가 후보</AppBadge>
            ) : (
              <AppBadge tone="success">{candidate.confidenceLabel}</AppBadge>
            )}
          </ActionRow>

          <div>
            <Title
              order={4}
              style={{
                color: 'var(--app-text-primary)',
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}
            >
              {candidate.title}
            </Title>
            <Text
              lineClamp={1}
              size="sm"
              style={{ color: 'var(--app-text-secondary)', marginTop: 2 }}
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
            {!isManualCandidate && (
              <AppBadge tone="muted">{candidate.formatLabel}</AppBadge>
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
            <Text
              lineClamp={1}
              size="xs"
              style={{ color: 'var(--app-text-muted)', fontStyle: 'italic' }}
            >
              별칭 {visibleAliases.join(' · ')}
            </Text>
          )}
        </Stack>
      </Group>
    </button>
  );
}
