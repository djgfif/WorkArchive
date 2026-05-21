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
  hasWikidataSource,
  isPreviewOrManualCandidate,
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
  const isManualCandidate = isPreviewOrManualCandidate(candidate);
  const scoreBreakdown = isManualCandidate
    ? []
    : candidate.scoreBreakdown?.filter((entry) => entry.weight > 0).slice(0, 5);
  const titleAliases = candidate.titleAliases?.filter(
    (titleAlias) => titleAlias !== candidate.title,
  );
  const needsManualReview = !isManualCandidate && candidate.confidence < 0.62;
  const wikidataIncluded = hasWikidataSource(candidate);

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
              {isManualCandidate ? (
                <AppBadge tone="accent">직접 추가 후보</AppBadge>
              ) : (
                <>
                  <AppBadge tone="success">
                    {candidate.confidenceLabel}
                  </AppBadge>
                  <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
                  {wikidataIncluded && (
                    <AppBadge tone="accent">
                      {candidate.sourceId === 'wikidata'
                        ? 'Wikidata 출처 포함'
                        : 'Wikidata 보강'}
                    </AppBadge>
                  )}
                </>
              )}
              {!isManualCandidate && candidate.catalogMatch && (
                <AppBadge tone="success">카탈로그 매칭</AppBadge>
              )}
            </ActionRow>

            <div>
              <Title order={3}>{candidate.title}</Title>
              <Text c="var(--mantine-color-dimmed)" size="sm">
                {getCandidateContributorText(candidate)}
              </Text>
            </div>
          </Stack>

          <Text c="var(--mantine-color-text)" lh={1.7}>
            {candidate.description || '설명은 아직 없습니다.'}
          </Text>

          <ActionRow>
            <MetricPill
              label={isManualCandidate ? '입력 방식' : '검색 출처'}
              value={
                isManualCandidate
                  ? '입력한 제목으로 직접 기록'
                  : sourceCoverage.summaryLabel
              }
            />
            <MetricPill label="형식" value={candidate.formatLabel} />
          </ActionRow>

          {titleAliases && titleAliases.length > 0 && (
            <ActionRow>
              {titleAliases.slice(0, 4).map((titleAlias) => (
                <AppBadge key={titleAlias} tone="muted">
                  {titleAlias}
                </AppBadge>
              ))}
            </ActionRow>
          )}

          {!isManualCandidate && candidate.relationsHint.length > 0 && (
            <ActionRow>
              {candidate.relationsHint.slice(0, 4).map((relation) => (
                <AppBadge
                  key={`${relation.relationType}:${relation.targetTitle}`}
                  tone="muted"
                >
                  {relation.relationType}: {relation.targetTitle}
                </AppBadge>
              ))}
            </ActionRow>
          )}
        </Stack>
      </Group>

      <Paper
        p="md"
        radius="md"
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-default-hover)',
            borderColor: 'var(--mantine-color-default-border)',
          },
        }}
        withBorder
      >
        <Stack gap="sm">
          <Text c="var(--mantine-color-dimmed)" fw={700} size="sm">
            {isManualCandidate ? '직접 추가 안내' : '검색 근거'}
          </Text>
          <Text c="var(--mantine-color-text)" size="sm">
            {isManualCandidate
              ? '외부 검색 결과가 아니라 입력한 제목으로 직접 기록합니다.'
              : candidate.reason}
          </Text>
          {!isManualCandidate && candidate.note && (
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {candidate.note}
            </Text>
          )}
          <ActionRow>
            {!isManualCandidate && (
              <>
                <AppBadge tone="muted">
                  외부 식별자 {sourceCoverage.externalIdentityCount}개
                </AppBadge>
                <AppBadge tone="muted">
                  릴리스 후보 {sourceCoverage.releaseCandidateCount}개
                </AppBadge>
              </>
            )}
            {candidate.existingRecord && (
              <AppBadge tone="warning">이미 내 기록에 있음</AppBadge>
            )}
          </ActionRow>
          {!isManualCandidate && (
            <ActionRow>
              {sourceCoverage.providerLabels.map((providerLabel) => (
                <AppBadge key={providerLabel} tone="muted">
                  {providerLabel}
                </AppBadge>
              ))}
            </ActionRow>
          )}
          {scoreBreakdown && scoreBreakdown.length > 0 && (
            <ActionRow>
              {scoreBreakdown.map((entry) => (
                <AppBadge key={`${entry.label}:${entry.weight}`} tone="success">
                  {entry.label}
                </AppBadge>
              ))}
            </ActionRow>
          )}
          {!isManualCandidate && candidate.sourceUrl && (
            <ActionRow>
              <Anchor
                href={candidate.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                source link
              </Anchor>
            </ActionRow>
          )}
        </Stack>
      </Paper>

      {needsManualReview && (
        <Alert
          color="yellow"
          radius="md"
          title="후보를 확인하고 직접 추가도 고려하세요"
          variant="light"
        >
          <Text c="inherit" size="sm">
            제목이나 출처 신호가 약한 후보입니다. 맞는 작품인지 확인한 뒤
            사용하거나, 검색을 닫고 직접 입력으로 계속할 수 있습니다.
          </Text>
        </Alert>
      )}

      {duplicateMatches.length > 0 && (
        <Alert
          color="blue"
          radius="md"
          title="비슷한 기록이 이미 있습니다"
          variant="light"
        >
          <Stack gap="sm">
            <Text c="inherit" size="sm">
              같은 작품일 수 있는 기록을 먼저 확인하세요. 다른 작품이라면 그대로
              입력을 채워도 됩니다.
            </Text>
            {duplicateMatches.map((work) =>
              work.deletedAt === null ? (
                <AppLinkButton
                  key={work.id}
                  to={`/works/${work.id}`}
                  tone="quiet"
                >
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
        <Text c="var(--mantine-color-dimmed)" size="sm">
          이 후보로 제목과 작품 정보를 채우고, 저장은 메인 폼에서 진행합니다.
        </Text>
        <AppButton onClick={onApply} tone="primary" type="button">
          {isManualCandidate
            ? '직접 추가로 입력 채우기'
            : '이 후보로 입력 채우기'}
        </AppButton>
      </ActionRow>
    </Stack>
  );
}
