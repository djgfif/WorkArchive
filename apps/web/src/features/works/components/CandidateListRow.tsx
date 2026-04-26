import { Group, Stack, Text, Title } from '@mantine/core';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
} from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports/services/imports.service';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
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

  return (
    <button
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
      aria-pressed={active}
      onClick={onSelect}
      style={{
        backgroundColor: active ? 'var(--app-surface-1)' : 'var(--app-surface-0)',
        border: active
          ? '2px solid var(--app-border-strong)'
          : '1px solid var(--app-border-color)',
        borderRadius: '0.875rem',
        color: 'inherit',
        cursor: 'pointer',
        padding: '0.875rem',
        textAlign: 'left',
        transition:
          'background-color 120ms ease, border-color 120ms ease',
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
            <AppBadge tone="success">{candidate.confidenceLabel}</AppBadge>
          </ActionRow>

          <div>
            <Title order={4}>{candidate.title}</Title>
            <Text c="var(--app-text-muted)" lineClamp={1} size="sm">
              {getCandidateContributorText(candidate)}
            </Text>
          </div>

          <ActionRow>
            <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
            <AppBadge tone="muted">{sourceCoverage.providerCountLabel}</AppBadge>
            {duplicateCount > 0 && (
              <AppBadge tone="warning">비슷한 기록 {duplicateCount}</AppBadge>
            )}
          </ActionRow>
        </Stack>
      </Group>
    </button>
  );
}
