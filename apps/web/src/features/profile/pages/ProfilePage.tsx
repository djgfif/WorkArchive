import { Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  KeyValueGrid,
  LoadingRows,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
  SurfaceLinkCard,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import {
  formatWorkDateTime,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatConsumedSummary(work: WorkRecord) {
  if (work.lastConsumedLabel) return work.lastConsumedLabel;
  if (work.lastConsumedAt) return `마지막 감상 ${formatWorkDateTime(work.lastConsumedAt)}`;
  return `최근 수정 ${formatWorkUpdatedAt(work.updatedAt)}`;
}

function RecentRecordLink({ accent = false, work }: { accent?: boolean; work: WorkRecord }) {
  return (
    <SurfaceLinkCard padding="md" to={`/works/${work.id}`} tone={accent ? 'hero' : 'subtle'}>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={2} miw={0}>
          <Text fw={700} lineClamp={1}>
            {work.title}
          </Text>
          <Text c="var(--mantine-color-dimmed)" lineClamp={1} size="sm">
            {work.author || '작가·제작자 미입력'}
          </Text>
        </Stack>
        <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
      </Group>
      <Group gap="xs" wrap="wrap">
        <AppBadge tone="muted">{getWorkTypeLabel(work.type)}</AppBadge>
        <AppBadge tone="muted">
          {work.rating === null ? '미평가' : `${work.rating}점`}
        </AppBadge>
        <AppBadge tone="muted">최근 수정 {formatWorkUpdatedAt(work.updatedAt)}</AppBadge>
      </Group>
    </SurfaceLinkCard>
  );
}

export function ProfilePage() {
  const { mode } = useAuthSession();
  const {
    averageRating,
    completedCount,
    contributorCollections,
    error,
    highlyRatedWorks,
    isLoading,
    inProgressCount,
    recentlyConsumedWorks,
    recentWorks,
    retry,
    seriesCollections,
    statusCounts,
    topTags,
    totalCount,
    typeCounts,
    unratedCount,
  } = useWorksOverview();
  const isAuthenticated = mode === 'authenticated';
  const leadRecentWork = recentWorks[0] ?? null;
  const hasRecentWorks = recentWorks.length > 0;
  const favoriteType = typeCounts[0] ?? null;
  const completedRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const inProgressRate = totalCount > 0 ? (inProgressCount / totalCount) * 100 : 0;
  const topRatedWork = highlyRatedWorks[0] ?? null;
  const flowWorks =
    recentlyConsumedWorks.length > 0 ? recentlyConsumedWorks : recentWorks.slice(0, 3);
  const clusterItems = [
    ...topTags.map((tag) => ({
      href: `/works?tag=${encodeURIComponent(tag.label)}`,
      label: tag.label,
      meta: `${tag.count}개 기록`,
    })),
    ...seriesCollections.slice(0, 2).map((collection) => ({
      href: collection.href,
      label: collection.label,
      meta: `시리즈 ${collection.totalCount}개`,
    })),
    ...contributorCollections.slice(0, 2).map((collection) => ({
      href: collection.href,
      label: collection.label,
      meta: `${collection.totalCount}개 기록`,
    })),
  ].slice(0, 6);

  return (
    <DetailPageTemplate>
      <PageHero
        actions={
          <>
            {leadRecentWork && (
              <AppLinkButton to={`/works/${leadRecentWork.id}`} tone="primary">
                이어 기록하기
              </AppLinkButton>
            )}
            <AppLinkButton to="/account">계정 센터</AppLinkButton>
            <AppLinkButton to="/works">작품 보기</AppLinkButton>
          </>
        }
        description={
          isAuthenticated
            ? '내 작품 기록의 규모와 감상 흐름을 개인용으로 요약합니다. 계정 관리와 백업은 별도 계정 센터에서 처리합니다.'
            : '지금은 게스트 모드입니다. 이 화면은 외부에 노출되지 않는 현재 기기의 개인 기록 요약입니다.'
        }
        eyebrow="개인 기록"
        meta={
          <>
            <MetricPill label="총 기록" value={totalCount} />
            <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
            <MetricPill label="완료" value={completedCount} />
            <MetricPill label="보는 중" value={inProgressCount} />
          </>
        }
        title={isAuthenticated ? '내 기록 요약' : '게스트 기록 요약'}
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard tone="hero">
          <SectionIntro
            description={
              favoriteType
                ? `${getWorkTypeLabel(favoriteType.value)} 기록이 가장 많고, ${unratedCount}개 작품은 아직 별점을 기다리고 있습니다.`
                : '첫 기록을 남기면 선호 유형, 높은 별점 작품, 미평가 항목이 이곳에 정리됩니다.'
            }
            eyebrow="취향 요약"
            title="내 취향 요약"
          />

          <KeyValueGrid
            columns={2}
            items={[
              { label: '평균 별점', value: formatAverageRating(averageRating) },
              {
                label: '선호 유형',
                value: favoriteType
                  ? `${getWorkTypeLabel(favoriteType.value)} ${favoriteType.count}개`
                  : '아직 없음',
              },
              {
                label: '높은 별점',
                value: topRatedWork
                  ? `${topRatedWork.title} · ${topRatedWork.rating?.toFixed(1)}점`
                  : '아직 없음',
              },
              { label: '미평가', value: `${unratedCount}개` },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="마지막으로 본 위치나 최근 수정한 작품을 기준으로 다시 이어갈 항목을 보여줍니다."
            eyebrow="감상 흐름"
            title="최근 감상 흐름"
          />

          {flowWorks.length > 0 ? (
            <Stack gap="sm">
              {flowWorks.map((work, index) => (
                <RecentRecordLink accent={index === 0} key={work.id} work={work} />
              ))}
            </Stack>
          ) : (
            <Text c="var(--mantine-color-dimmed)">
              최근 감상 흐름이 없습니다. 작품을 추가하거나 감상 위치를 남기면 이곳에 표시됩니다.
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={`완료율 ${formatPercent(completedRate)}, 진행 중 비율 ${formatPercent(inProgressRate)}입니다.`}
            eyebrow="기록 상태"
            title="상태 분포"
          />

          <Stack gap="sm">
            <Progress.Root size="lg">
              <Progress.Section color="teal" value={completedRate} />
              <Progress.Section color="archive" value={inProgressRate} />
            </Progress.Root>
            <KeyValueGrid
              columns={2}
              items={[
                { label: getWorkStatusLabel('planned'), value: statusCounts.planned },
                { label: getWorkStatusLabel('in_progress'), value: statusCounts.in_progress },
                { label: getWorkStatusLabel('completed'), value: statusCounts.completed },
                { label: getWorkStatusLabel('dropped'), value: statusCounts.dropped },
              ]}
            />
          </Stack>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="장르, 개인 태그, 시리즈, 제작자 단위로 자주 남긴 취향을 묶어 보여줍니다."
            eyebrow="취향 클러스터"
            title="자주 남긴 취향"
          />

          {clusterItems.length > 0 ? (
            <Group gap="xs" wrap="wrap">
              {clusterItems.map((item) => (
                <AppLinkButton
                  key={`${item.href}:${item.label}`}
                  size="compact-xs"
                  to={item.href}
                  tone="quiet"
                >
                  {item.label} · {item.meta}
                </AppLinkButton>
              ))}
            </Group>
          ) : (
            <Text c="var(--mantine-color-dimmed)">
              장르나 태그를 남기면 취향 묶음이 이곳에 표시됩니다.
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="공개 피드나 팔로우 없이, 내 기록을 다시 열고 이어 쓰기 위한 다음 행동만 제공합니다."
            eyebrow="이어 기록하기"
            title="다음에 이어갈 기록"
          />

          {error && (
            <StateMessage
              actions={
                <>
                  <AppButton onClick={retry} tone="primary" type="button">
                    다시 불러오기
                  </AppButton>
                  <AppLinkButton to="/works" tone="secondary">
                    작품 목록 열기
                  </AppLinkButton>
                  <AppLinkButton
                    aria-label="개인 기록 오류 상태에서 작품 추가"
                    to="/works/new"
                    tone="quiet"
                  >
                    작품 추가
                  </AppLinkButton>
                </>
              }
              description={error}
              title="개인 기록 요약을 불러오지 못했습니다."
              tone="error"
            />
          )}

          {!error && isLoading && <LoadingRows rows={2} />}

          {!error && !isLoading && !hasRecentWorks && (
            <Stack gap="sm">
              <AppBadge tone="accent">첫 기록 대기</AppBadge>
              <Text c="var(--mantine-color-dimmed)">
                첫 작품을 등록하면 이곳에서 최근 기록으로 바로 돌아갈 수 있습니다.
              </Text>
            </Stack>
          )}

          {!error && !isLoading && hasRecentWorks && (
            <Stack gap="sm">
              {recentWorks.slice(0, 3).map((work, index) => (
                <SurfaceLinkCard
                  key={work.id}
                  padding="md"
                  to={`/works/${work.id}`}
                  tone={index === 0 ? 'hero' : 'subtle'}
                >
                  <Group align="flex-start" justify="space-between" wrap="nowrap">
                    <Stack gap={2} miw={0}>
                      <Text fw={700} lineClamp={1}>
                        {work.title}
                      </Text>
                      <Text c="var(--mantine-color-dimmed)" lineClamp={1} size="sm">
                        {formatConsumedSummary(work)}
                      </Text>
                    </Stack>
                    <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                  </Group>
                </SurfaceLinkCard>
              ))}
            </Stack>
          )}

          <Group gap="sm" wrap="wrap">
            <AppLinkButton to="/works/new">작품 추가</AppLinkButton>
            <AppLinkButton to="/works">작품 보기</AppLinkButton>
            <AppLinkButton to="/account" tone="quiet">
              계정 센터
            </AppLinkButton>
          </Group>
        </SectionCard>
      </SimpleGrid>
    </DetailPageTemplate>
  );
}
