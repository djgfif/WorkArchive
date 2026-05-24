import { Alert, SimpleGrid, Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  ChipSummary,
} from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports';
import type { CandidateSourceCoverage } from './quick-add-helpers';

interface CandidateFieldSummary {
  filled: string[];
  missing: string[];
}

interface ImportedCandidateSummaryProps {
  candidate: ImportCandidate;
  fieldSummary: CandidateFieldSummary;
  onBackToSearch: () => void;
  onReset: () => void;
  sourceCoverage: CandidateSourceCoverage;
}

export function ImportedCandidateSummary({
  candidate,
  fieldSummary,
  onBackToSearch,
  onReset,
  sourceCoverage,
}: ImportedCandidateSummaryProps) {
  return (
    <Alert color="blue" radius="lg" variant="light">
      <Stack gap="sm">
        <ActionRow justify="space-between">
          <AppBadge tone="accent">검색으로 채운 정보</AppBadge>
          <ActionRow>
            <AppButton
              onClick={onBackToSearch}
              size="compact-sm"
              tone="ghost"
              type="button"
            >
              다시 검색
            </AppButton>
            <AppButton
              onClick={onReset}
              size="compact-sm"
              tone="ghost"
              type="button"
            >
              직접 입력으로 전환
            </AppButton>
          </ActionRow>
        </ActionRow>
        <Text c="inherit" fw={700}>
          {candidate.title}
        </Text>
        <Text c="inherit" size="sm">
          {candidate.reason}
        </Text>
        <ActionRow>
          <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
          <AppBadge tone="muted">{sourceCoverage.summaryLabel}</AppBadge>
        </ActionRow>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <ChipSummary
            emptyLabel="자동으로 채워진 필드가 없습니다."
            label="채워진 정보"
            values={fieldSummary.filled}
          />
          <ChipSummary
            emptyLabel="지금 바로 추가 입력할 항목이 없습니다."
            label="내가 채우면 좋은 정보"
            values={fieldSummary.missing}
          />
        </SimpleGrid>
      </Stack>
    </Alert>
  );
}
