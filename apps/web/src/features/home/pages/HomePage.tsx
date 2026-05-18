import { useState, type FormEvent } from 'react';
import { Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
  LoadingRows,
  MetricPill,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { HomeHubPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  ArchiveHero,
  ArchiveSearchBar,
  WorkRowCard,
  WorkShelf,
} from '../../works/components/ArchiveComponents';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';

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
    retry,
    totalCount,
  } = useWorksOverview();
  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';
  const continueWorks = recentWorks
    .filter((work) => work.status === 'in_progress')
    .slice(0, 8);

  function handleSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    navigate(
      normalizedSearchTerm
        ? `/works?q=${encodeURIComponent(normalizedSearchTerm)}`
        : '/works',
    );
  }

  return (
    <HomeHubPageTemplate>
      <ArchiveHero
        actions={
          <AppLinkButton size="md" to="/works/new" tone="primary">
            작품 추가
          </AppLinkButton>
        }
        description={
          isAuthenticated
            ? `${user?.email ?? '내 계정'}의 개인 감상 기록 저장소`
            : '이 기기에 먼저 저장되는 개인 감상 기록 저장소'
        }
        eyebrow="Personal archive"
        title="기록 홈"
      >
        <form onSubmit={handleSearchSubmit}>
          <Group align="center" gap="sm" wrap="nowrap">
            <ArchiveSearchBar
              aria-label="아카이브 검색"
              onChange={setSearchTerm}
              onSubmit={() => handleSearchSubmit()}
              placeholder="작품, 작가, 한줄평을 검색"
              value={searchTerm}
            />
            <AppButton tone="primary" type="submit">
              검색
            </AppButton>
          </Group>
        </form>
      </ArchiveHero>

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
                aria-label="최근 기록 오류 상태에서 작품 추가"
                to="/works/new"
                tone="quiet"
              >
                작품 추가
              </AppLinkButton>
            </>
          }
          description={error}
          title="최근 기록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {!error && isLoading && <LoadingRows rows={4} />}

      {!error && !isLoading && (
        <Stack gap={48}>
          <WorkShelf
            empty={
              <Stack gap="sm">
                <Title order={2}>이어볼 작품</Title>
                <Text c="dimmed">
                  보는 중인 작품을 추가하면 이곳에 포스터로 이어집니다.
                </Text>
              </Stack>
            }
            title={
              <Group justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Title order={2}>이어보기</Title>
                  <Text c="dimmed" size="sm">
                    보는 중인 기록만 조용히 모았습니다.
                  </Text>
                </Stack>
                <AppLinkButton to="/works?status=in_progress" tone="quiet">
                  모두 보기
                </AppLinkButton>
              </Group>
            }
            works={continueWorks}
          />

          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={4}>
                <Title order={2}>최근 수정</Title>
                <Text c="dimmed" size="sm">
                  방금 손본 작품을 빠르게 다시 엽니다.
                </Text>
              </Stack>
              <AppLinkButton to="/works" tone="quiet">
                작품 목록
              </AppLinkButton>
            </Group>
            {recentWorks.length > 0 ? (
              <Stack gap="sm">
                {recentWorks.slice(0, 5).map((work) => (
                  <WorkRowCard key={work.id} work={work} />
                ))}
              </Stack>
            ) : (
              <StateMessage
                actions={
                  <AppLinkButton to="/works/new" tone="primary">
                    첫 작품 추가
                  </AppLinkButton>
                }
                description="첫 기록을 만들면 홈에서 이어보기와 최근 수정 흐름이 시작됩니다."
                title="최근 기록 없음"
                tone="info"
              />
            )}
          </Stack>

          <Stack gap="md">
            <Title order={2}>아카이브 요약</Title>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
              <MetricPill label="전체" value={`${totalCount}개`} />
              <MetricPill label="보는 중" value={`${inProgressCount}개`} />
              <MetricPill label="완료" value={`${completedCount}개`} />
              <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </HomeHubPageTemplate>
  );
}
