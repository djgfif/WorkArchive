import { useState, type FormEvent } from 'react';
import { Group, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
  SurfaceLinkCard,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { HomeHubPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { mode, user } = useAuthSession();
  const {
    averageRating,
    completedCount,
    error,
    inProgressCount,
    isLoading,
    recentWorks,
    totalCount,
  } = useWorksOverview();
  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';
  const leadRecentWork = recentWorks[0] ?? null;

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    navigate(
      normalizedSearchTerm ? `/works?q=${encodeURIComponent(normalizedSearchTerm)}` : '/works',
    );
  }

  return (
    <HomeHubPageTemplate>
      <PageHero
        actions={
          <ActionRow justify="flex-end">
            <AppLinkButton to="/works/new" tone="primary">
              작품 추가
            </AppLinkButton>
            <AppLinkButton to="/works">작품 열기</AppLinkButton>
          </ActionRow>
        }
        description={
          isAuthenticated
            ? `${user?.email ?? '계정'}으로 이어서 기록 중입니다. 검색과 최근 기록에서 바로 다음 행동으로 넘어갈 수 있습니다.`
            : '설명보다 기록 시작이 먼저 보이도록 검색, 추가, 최근 기록을 앞에 두었습니다.'
        }
        eyebrow="홈"
        meta={
          <>
            <MetricPill label="기록한 작품" value={`${totalCount}개`} />
            <MetricPill label="보는 중" value={`${inProgressCount}개`} />
            <MetricPill label="완료" value={`${completedCount}개`} />
          </>
        }
        title="다음 기록을 바로 이어가세요"
      />

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
        <SectionCard gap="lg" tone="hero">
          <SectionIntro
            description="제목이나 작가로 바로 찾은 뒤, 작품 목록이나 추가 흐름으로 이어집니다."
            eyebrow="빠른 시작"
            title="검색에서 바로 시작"
            titleOrder={2}
          />

          <form onSubmit={handleSearchSubmit}>
            <Group align="flex-end" wrap="wrap">
              <TextInput
                aria-label="작품 검색"
                flex={1}
                miw={240}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="제목이나 작가로 작품 찾기"
                value={searchTerm}
              />
              <AppButton tone="primary" type="submit">
                작품 찾기
              </AppButton>
            </Group>
          </form>

          <ActionRow>
            <AppBadge tone="accent">검색 우선</AppBadge>
            <AppBadge tone="default">최근 기록 복귀</AppBadge>
            <AppBadge tone="default">빠른 추가 상시 노출</AppBadge>
          </ActionRow>
        </SectionCard>

        <SectionCard gap="lg" tone={leadRecentWork ? 'default' : 'subtle'}>
          <SectionIntro
            description={
              leadRecentWork
                ? `${leadRecentWork.title} 기록을 바로 이어볼 수 있습니다.`
                : '최근 기록이 생기면 이 영역에서 바로 복귀할 수 있습니다.'
            }
            eyebrow="이어보기"
            title={leadRecentWork ? '가장 최근 기록' : '복귀할 기록이 아직 없습니다'}
            titleOrder={2}
          />

          {leadRecentWork ? (
            <SurfaceLinkCard to={`/works/${leadRecentWork.id}`} tone="subtle">
              <Group align="flex-start" wrap="nowrap">
                <ArtworkPoster
                  thumbnailUrl={leadRecentWork.thumbnailUrl}
                  title={leadRecentWork.title}
                  typeLabel={getWorkTypeLabel(leadRecentWork.type)}
                  variant="row"
                />
                <Stack flex={1} gap="sm" miw={0}>
                  <ActionRow>
                    <AppBadge tone="accent">최근 기록</AppBadge>
                    <AppBadge>{getWorkStatusLabel(leadRecentWork.status)}</AppBadge>
                  </ActionRow>
                  <div>
                    <Title order={3}>{leadRecentWork.title}</Title>
                    <Text c="var(--app-text-muted)">
                      최근 수정 {formatWorkUpdatedAt(leadRecentWork.updatedAt)}
                    </Text>
                  </div>
                  <Text c="var(--app-text-secondary)">
                    {leadRecentWork.shortReview ||
                      leadRecentWork.description ||
                      '아직 남긴 메모가 없습니다.'}
                  </Text>
                </Stack>
              </Group>
            </SurfaceLinkCard>
          ) : (
            <AppLinkButton to="/works/new" tone="primary">
              첫 작품 추가
            </AppLinkButton>
          )}
        </SectionCard>

        <SectionCard gap="lg" tone="subtle">
          <SectionIntro
            description="통계는 빠르게만 읽고, 본문에서는 실제 작품 기록을 먼저 보게 정리했습니다."
            eyebrow="요약"
            title="기록 상태"
            titleOrder={2}
          />

          {error ? (
            <FeedbackMessage tone="error">{error}</FeedbackMessage>
          ) : (
            <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="sm">
              <MetricPill label="평균 별점" value={isLoading ? '...' : formatAverageRating(averageRating)} />
              <MetricPill label="완료" value={isLoading ? '...' : `${completedCount}개`} />
              <MetricPill label="보는 중" value={isLoading ? '...' : `${inProgressCount}개`} />
              <MetricPill label="전체" value={isLoading ? '...' : `${totalCount}개`} />
            </SimpleGrid>
          )}
        </SectionCard>
      </SimpleGrid>

      <SectionCard>
        <Group align="flex-end" justify="space-between" wrap="wrap">
          <SectionIntro
            description="최근 수정한 작품부터 바로 다시 들어갈 수 있도록 정리했습니다."
            eyebrow="최근 기록"
            title="최근 남긴 작품"
          />
          <ActionRow justify="flex-end">
            <AppLinkButton to="/works">작품 전체 보기</AppLinkButton>
          </ActionRow>
        </Group>

        {error && (
          <Text c="var(--app-text-muted)">
            최근 기록을 불러오지 못했습니다. 작품 탭에서 다시 확인해주세요.
          </Text>
        )}

        {!error && isLoading && (
          <Text c="var(--app-text-muted)">최근 기록을 불러오는 중입니다.</Text>
        )}

        {!error && !isLoading && recentWorks.length === 0 && (
          <StateMessage
            actions={
              <AppLinkButton to="/works/new" tone="primary">
                작품 추가
              </AppLinkButton>
            }
            description="첫 작품을 추가하면 홈에서 최근 기록과 핵심 통계를 바로 볼 수 있습니다."
            title="아직 최근 기록이 없습니다."
            tone="info"
          />
        )}

        {!error && !isLoading && recentWorks.length > 0 && (
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            {recentWorks.map((work, index) => (
              <SurfaceLinkCard key={work.id} to={`/works/${work.id}`} tone={index === 0 ? 'hero' : 'default'}>
                <Group align="flex-start" wrap="nowrap">
                  <ArtworkPoster
                    thumbnailUrl={work.thumbnailUrl}
                    title={work.title}
                    typeLabel={getWorkTypeLabel(work.type)}
                    variant="row"
                  />

                  <Stack flex={1} gap="sm" miw={0}>
                    <ActionRow>
                      {index === 0 && <AppBadge tone="accent">가장 최근</AppBadge>}
                      <AppBadge>{getWorkTypeLabel(work.type)}</AppBadge>
                      <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                      <AppBadge>{work.rating === null ? '미평가' : `${work.rating}점`}</AppBadge>
                    </ActionRow>

                    <div>
                      <Title order={index === 0 ? 3 : 4}>{work.title}</Title>
                      <Text c="var(--app-text-muted)">
                        {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
                      </Text>
                    </div>

                    <Text c="var(--app-text-secondary)">
                      {work.shortReview || work.description || '아직 남긴 메모가 없습니다.'}
                    </Text>
                  </Stack>
                </Group>
              </SurfaceLinkCard>
            ))}
          </SimpleGrid>
        )}
      </SectionCard>
    </HomeHubPageTemplate>
  );
}
