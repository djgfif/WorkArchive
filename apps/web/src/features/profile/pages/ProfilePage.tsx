import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
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
import { useSyncDashboard } from '../../sync/hooks/useSyncDashboard';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import {
  formatWorkDateTime,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';

function formatOptionalDate(value: string | null, fallback = '아직 없음') {
  return value ? formatWorkDateTime(value) : fallback;
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
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
  const { mode, user } = useAuthSession();
  const {
    averageRating,
    completedCount,
    error,
    isLoading,
    recentWorks,
    retry,
    totalCount,
  } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const leadRecentWork = recentWorks[0] ?? null;
  const hasRecentWorks = recentWorks.length > 0;

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
            ? '내 작품 기록의 규모, 감상 흐름, 운영 상태를 개인용으로 요약합니다. 계정 관리와 동기화는 별도 계정 센터에서 처리합니다.'
            : '지금은 게스트 모드입니다. 이 화면은 외부에 노출되지 않는 현재 기기의 개인 기록 요약입니다.'
        }
        eyebrow="개인 기록"
        meta={
          <>
            <MetricPill label="기록한 작품" value={totalCount} />
            <MetricPill label="완료" value={completedCount} />
            <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
          </>
        }
        title={isAuthenticated ? '내 기록 요약' : '게스트 기록 요약'}
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro
            description={
              isAuthenticated
                ? `${user?.email ?? '계정'} 기준의 개인 아카이브입니다. 이 요약은 내 기기와 계정 기록을 확인하기 위한 화면입니다.`
                : '로그인하지 않아도 기록은 시작할 수 있습니다. 계정을 만들면 이 흐름을 계정 아카이브와 동기화할 수 있습니다.'
            }
            eyebrow="기록 범위"
            title={isAuthenticated ? '내 취향 아카이브' : '게스트 기록 미리보기'}
          />

          <Group gap="xs" wrap="wrap">
            <AppBadge>개인 요약</AppBadge>
            <AppBadge>기록 상태</AppBadge>
            <AppBadge>취향 통계</AppBadge>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="기록량과 감상 흐름을 빠르게 확인합니다. 관리 동작은 계정 센터에서 이어집니다."
            eyebrow="기록 요약"
            title="지금 보이는 아카이브 상태"
          />

          <KeyValueGrid
            items={[
              { label: '대기 중', value: `${queueItems.length}건` },
              { label: '충돌', value: `${conflictWorks.length}건` },
              { label: '최근 동기화', value: formatOptionalDate(lastSuccessfulPullAt) },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="동기화, 설정, 세션, 로컬 백업은 개인 기록 요약과 분리된 관리 영역에서 다룹니다."
            eyebrow="계정 센터"
            title="관리 기능은 따로 분리했습니다"
          />

          <Group gap="sm">
            <AppLinkButton to="/account">계정 센터 열기</AppLinkButton>
            <AppLinkButton to="/account/settings">설정 열기</AppLinkButton>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="공개 피드나 팔로우 없이, 내 기록을 다시 열고 이어 쓰기 위한 다음 행동만 제공합니다."
            eyebrow="다음 행동"
            title="개인 기록 이어가기"
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
                <RecentRecordLink accent={index === 0} key={work.id} work={work} />
              ))}
            </Stack>
          )}

          <Group gap="sm" wrap="wrap">
            <AppLinkButton to="/works/new">작품 추가</AppLinkButton>
            <AppLinkButton to="/works">작품 보기</AppLinkButton>
          </Group>
        </SectionCard>
      </SimpleGrid>
    </DetailPageTemplate>
  );
}
