import { Alert, Anchor, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  MetricPill,
} from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports/services/imports.service';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
} from './quick-add-helpers';
import { getWorkTypeLabel } from '../utils/work-options';

interface CandidatePreviewPanelProps {
  candidate: ImportCandidate;
  duplicateMatches: WorkRecord[];
  onApply: () => void;
}

export function CandidatePreviewPanel({
  candidate,
  duplicateMatches,
  onApply,
}: CandidatePreviewPanelProps) {
  const sourceCoverage = getCandidateSourceCoverage(candidate);

  return (
    <Stack gap="lg">
      <Group align="flex-start" gap="lg" wrap="wrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="detail"
        />

        <Stack flex={1} gap="md" miw={0}>
          <Stack gap="xs">
            <ActionRow>
              <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
              <AppBadge tone="success">{candidate.confidenceLabel}</AppBadge>
              <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
              {candidate.catalogMatch && (
                <AppBadge tone="success">카탈로그 매칭</AppBadge>
              )}
            </ActionRow>

            <div>
              <Title order={3}>{candidate.title}</Title>
              <Text c="var(--app-text-muted)" size="sm">
                {getCandidateContributorText(candidate)}
              </Text>
            </div>
          </Stack>

          <Text c="var(--app-text-secondary)" lh={1.7}>
            {candidate.description || '설명은 아직 없습니다.'}
          </Text>

          <ActionRow>
            <MetricPill label="검색 출처" value={sourceCoverage.summaryLabel} />
            <MetricPill label="형식" value={candidate.formatLabel} />
          </ActionRow>
        </Stack>
      </Group>

      <Paper
        p="md"
        radius="lg"
        styles={{
          root: {
            backgroundColor: 'var(--app-surface-0)',
            borderColor: 'var(--app-border-color)',
          },
        }}
        withBorder
      >
        <Stack gap="sm">
          <Text c="var(--app-text-muted)" fw={700} size="sm">
            검색 근거
          </Text>
          <Text c="var(--app-text-secondary)" size="sm">
            {candidate.reason}
          </Text>
          {candidate.note && (
            <Text c="var(--app-text-muted)" size="sm">
              {candidate.note}
            </Text>
          )}
          <ActionRow>
            <AppBadge tone="muted">
              외부 식별자 {sourceCoverage.externalIdentityCount}개
            </AppBadge>
            <AppBadge tone="muted">
              릴리스 후보 {sourceCoverage.releaseCandidateCount}개
            </AppBadge>
            {candidate.existingRecord && (
              <AppBadge tone="warning">이미 내 기록에 있음</AppBadge>
            )}
          </ActionRow>
          <ActionRow>
            {sourceCoverage.providerLabels.map((providerLabel) => (
              <AppBadge key={providerLabel} tone="muted">
                {providerLabel}
              </AppBadge>
            ))}
          </ActionRow>
          {candidate.sourceUrl && (
            <ActionRow>
              <Anchor href={candidate.sourceUrl} rel="noreferrer" target="_blank">
                source link
              </Anchor>
            </ActionRow>
          )}
        </Stack>
      </Paper>

      {duplicateMatches.length > 0 && (
        <Alert color="blue" radius="lg" title="비슷한 기록이 이미 있습니다" variant="light">
          <Stack gap="sm">
            <Text c="inherit" size="sm">
              같은 작품일 수 있는 기록을 먼저 확인하세요. 다른 작품이라면 그대로 입력을 채워도 됩니다.
            </Text>
            {duplicateMatches.map((work) =>
              work.deletedAt === null ? (
                <AppLinkButton key={work.id} to={`/works/${work.id}`} tone="quiet">
                  {work.title}
                </AppLinkButton>
              ) : (
                <AppLinkButton
                  key={work.id}
                  to={`/works?scope=trash&q=${encodeURIComponent(work.title)}`}
                  tone="quiet"
                >
                  {work.title} 휴지통에서 보기
                </AppLinkButton>
              ),
            )}
          </Stack>
        </Alert>
      )}

      <ActionRow justify="space-between">
        <Text c="var(--app-text-muted)" size="sm">
          이 후보로 제목과 작품 정보를 채우고, 저장은 메인 폼에서 진행합니다.
        </Text>
        <AppButton onClick={onApply} tone="primary" type="button">
          이 후보로 입력 채우기
        </AppButton>
      </ActionRow>
    </Stack>
  );
}
