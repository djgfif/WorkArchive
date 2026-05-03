import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { Group, Progress, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppLinkButton,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { WorkspacePageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { worksRepository } from '../../works/services/works.repository';
import {
  formatWorkDate,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';
import {
  calculatePersonalInsights,
  type PersonalInsights,
} from '../services/personal-insights.service';

interface InsightsState {
  error: string | null;
  insights: PersonalInsights | null;
  isLoading: boolean;
}

const initialState: InsightsState = {
  error: null,
  insights: null,
  isLoading: true,
};

function formatRating(value: number | null) {
  return value === null ? '아직 없음' : `${value.toFixed(1)}점`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getMaxCount(entries: Array<{ count: number }>) {
  return Math.max(1, ...entries.map((entry) => entry.count));
}

function getRecentActivityDate(work: WorkRecord) {
  return work.lastConsumedAt ?? work.startedAt ?? work.updatedAt;
}

function getTopEntries<T extends string>(counts: Record<T, number>) {
  return Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort(
      ([, leftCount], [, rightCount]) => Number(rightCount) - Number(leftCount),
    )
    .slice(0, 6) as Array<[T, number]>;
}

export function InsightsPage() {
  const { archiveScopeKey, mode } = useAuthSession();
  const [state, setState] = useState<InsightsState>(initialState);

  useEffect(() => {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: currentState.insights === null,
    }));

    const subscription = liveQuery(async () => {
      const works = await worksRepository.listAll();

      return calculatePersonalInsights(works);
    }).subscribe({
      error: (error) => {
        setState({
          error:
            error instanceof Error
              ? error.message
              : '인사이트를 불러오지 못했습니다.',
          insights: null,
          isLoading: false,
        });
      },
      next: (insights) => {
        setState({
          error: null,
          insights,
          isLoading: false,
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  const insights = state.insights;

  return (
    <WorkspacePageTemplate>
      <Stack gap="lg">
        <SectionCard gap="lg" padding="xl" tone="hero">
          <SectionIntro
            description={
              mode === 'authenticated'
                ? '현재 계정 로컬 아카이브에 저장된 개인 기록만 집계합니다.'
                : '현재 기기의 guest 로컬 아카이브에 저장된 개인 기록만 집계합니다.'
            }
            eyebrow="개인 인사이트"
            title="내 기록 요약"
            titleOrder={1}
          />

          {insights && (
            <Group gap="sm" wrap="wrap">
              <MetricPill label="전체 기록" value={insights.activeCount} />
              <MetricPill
                label="평균 별점"
                value={formatRating(insights.averageRating)}
              />
              <MetricPill
                label="올해 완료한 기록"
                value={insights.completedThisYearCount}
              />
              <MetricPill label="즐겨찾기" value={insights.favoriteCount} />
              <MetricPill
                label="중단률"
                value={formatPercent(insights.droppedRate)}
              />
            </Group>
          )}
        </SectionCard>

        {state.isLoading && (
          <StateMessage
            description="현재 로컬 아카이브를 집계하고 있습니다."
            title="인사이트를 불러오는 중입니다"
            tone="loading"
          />
        )}

        {state.error && (
          <StateMessage
            description={state.error}
            title="인사이트를 불러오지 못했습니다"
            tone="error"
          />
        )}

        {!state.isLoading && !state.error && insights?.activeCount === 0 && (
          <StateMessage
            actions={
              <AppLinkButton to="/works/new">첫 작품 추가</AppLinkButton>
            }
            description="작품을 추가하면 매체, 상태, 별점, 즐겨찾기 기준으로 내 기록을 요약합니다."
            title="아직 집계할 기록이 없습니다"
            tone="info"
          />
        )}

        {insights && insights.activeCount > 0 && (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <SectionCard>
              <SectionIntro
                description="내가 어떤 매체를 주로 기록하고 있는지 보여줍니다."
                eyebrow="매체"
                title="매체별 기록"
                titleOrder={2}
              />
              <Stack gap="sm">
                {getTopEntries(insights.typeCounts).map(([type, count]) => (
                  <Group justify="space-between" key={type}>
                    <Text fw={700}>{getWorkTypeLabel(type)}</Text>
                    <AppBadge tone="accent">{count}개</AppBadge>
                  </Group>
                ))}
              </Stack>
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="작품 메타데이터의 장르를 기준으로 취향의 큰 분포를 봅니다."
                eyebrow="장르"
                title="장르별 분포"
                titleOrder={2}
              />
              {insights.genreCounts.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  아직 장르가 있는 작품이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.genreCounts.map(({ count, genre }) => {
                    const maxCount = getMaxCount(insights.genreCounts);

                    return (
                      <Stack gap={4} key={genre}>
                        <Group justify="space-between">
                          <Text fw={700}>{genre}</Text>
                          <AppBadge tone="accent">{count}개</AppBadge>
                        </Group>
                        <Progress
                          aria-label={`${genre} 장르 ${count}개`}
                          color="archive"
                          radius="xl"
                          size="sm"
                          value={(count / maxCount) * 100}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="장르가 아니라 내가 붙인 개인 분류를 기준으로 자주 쓰는 태그를 보여줍니다."
                eyebrow="개인 태그"
                title="자주 쓴 태그"
                titleOrder={2}
              />
              {insights.tagCounts.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  아직 개인 태그를 남긴 작품이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.tagCounts.map(({ count, tag }) => (
                    <Group justify="space-between" key={tag}>
                      <Text fw={700}>{tag}</Text>
                      <AppBadge tone="accent">{count}개</AppBadge>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="볼 예정, 보는 중, 완료 같은 현재 상태 분포입니다."
                eyebrow="상태"
                title="상태별 분포"
                titleOrder={2}
              />
              <Stack gap="sm">
                {getTopEntries(insights.statusCounts).map(([status, count]) => (
                  <Group justify="space-between" key={status}>
                    <Text fw={700}>{getWorkStatusLabel(status)}</Text>
                    <AppBadge tone="success">{count}개</AppBadge>
                  </Group>
                ))}
              </Stack>
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="평가한 작품이 어느 별점에 모여 있는지 보여줍니다."
                eyebrow="별점"
                title="별점 분포"
                titleOrder={2}
              />
              {insights.ratingDistribution.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  아직 별점을 남긴 작품이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.ratingDistribution.map(({ count, rating }) => (
                    <Group justify="space-between" key={rating}>
                      <Text fw={700}>{rating.toFixed(1)}점</Text>
                      <AppBadge tone="accent">{count}개</AppBadge>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="올해 완료한 기록을 월별로 나눠 봅니다."
                eyebrow="완료 흐름"
                title="월별 완료"
                titleOrder={2}
              />
              {insights.completedThisYearCount === 0 ? (
                <Text c="var(--app-text-muted)">
                  올해 완료한 작품이 아직 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.monthlyCompletedCounts
                    .filter(({ count }) => count > 0)
                    .map(({ count, month }) => {
                      const maxCount = getMaxCount(insights.monthlyCompletedCounts);

                      return (
                        <Stack gap={4} key={month}>
                          <Group justify="space-between">
                            <Text fw={700}>{month}월</Text>
                            <AppBadge tone="success">{count}개</AppBadge>
                          </Group>
                          <Progress
                            aria-label={`${month}월 완료 ${count}개`}
                            color="archive"
                            radius="xl"
                            size="sm"
                            value={(count / maxCount) * 100}
                          />
                        </Stack>
                      );
                    })}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="높게 평가한 작품을 다시 찾기 쉽게 모읍니다."
                eyebrow="다시 보기"
                title="높은 평가 작품"
                titleOrder={2}
              />
              {insights.topRatedWorks.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  아직 별점을 남긴 작품이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.topRatedWorks.map((work: WorkRecord) => (
                    <Group justify="space-between" key={work.id} wrap="nowrap">
                      <div>
                        <Title order={3} size="h4">
                          {work.title}
                        </Title>
                        <Text c="var(--app-text-muted)" size="sm">
                          {getWorkTypeLabel(work.type)}
                        </Text>
                      </div>
                      <AppBadge tone="accent">
                        {formatRating(work.rating)}
                      </AppBadge>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="올해 기록한 작품 중 별점이 높은 항목입니다."
                eyebrow="올해 최고"
                title="올해 높은 평가"
                titleOrder={2}
              />
              {insights.topRatedThisYearWorks.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  올해 별점을 남긴 작품이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.topRatedThisYearWorks.map((work: WorkRecord) => (
                    <Group justify="space-between" key={work.id} wrap="nowrap">
                      <div>
                        <Title order={3} size="h4">
                          {work.title}
                        </Title>
                        <Text c="var(--app-text-muted)" size="sm">
                          {getWorkTypeLabel(work.type)}
                        </Text>
                      </div>
                      <AppBadge tone="accent">
                        {formatRating(work.rating)}
                      </AppBadge>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionIntro
                description="보는 중이거나 보류한 기록 중 30일 이상 움직임이 없는 항목입니다."
                eyebrow="점검 필요"
                title="오래 방치한 작품"
                titleOrder={2}
              />
              {insights.staleWorks.length === 0 ? (
                <Text c="var(--app-text-muted)">
                  오래 방치된 진행 중 기록이 없습니다.
                </Text>
              ) : (
                <Stack gap="sm">
                  {insights.staleWorks.map((work: WorkRecord) => (
                    <Group justify="space-between" key={work.id} wrap="nowrap">
                      <div>
                        <Title order={3} size="h4">
                          {work.title}
                        </Title>
                        <Text c="var(--app-text-muted)" size="sm">
                          {getWorkStatusLabel(work.status)} · 최근 활동 {formatWorkDate(getRecentActivityDate(work))}
                        </Text>
                      </div>
                      <AppLinkButton size="compact-sm" to={`/works/${work.id}`}>
                        열기
                      </AppLinkButton>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </SimpleGrid>
        )}
      </Stack>
    </WorkspacePageTemplate>
  );
}
