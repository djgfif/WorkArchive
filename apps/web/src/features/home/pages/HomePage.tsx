import { useState, type FormEvent } from 'react';
import { Group, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link, useNavigate } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  MetricPill,
  PageSection,
  SectionCard,
  SectionIntro,
  StateMessage,
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

interface RecentWorkRowProps {
  highlight?: boolean;
  isLast?: boolean;
  work: WorkRecord;
}

function RecentWorkRow({
  highlight = false,
  isLast = false,
  work,
}: RecentWorkRowProps) {
  return (
    <Paper
      component={Link}
      p="lg"
      radius={0}
      styles={{
        root: {
          backgroundColor: highlight ? 'var(--app-surface-1)' : 'transparent',
          border: 'none',
          borderBottom: isLast ? 'none' : '1px solid var(--app-border-color)',
          display: 'block',
          textDecoration: 'none',
        },
      }}
      to={`/works/${work.id}`}
      withBorder={false}
    >
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={getWorkTypeLabel(work.type)}
          variant="row"
        />

        <Stack flex={1} gap="xs" miw={0}>
          <ActionRow>
            {highlight && <AppBadge tone="accent">가장 최근</AppBadge>}
            <AppBadge>{getWorkTypeLabel(work.type)}</AppBadge>
            <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
            <AppBadge>{work.rating === null ? '미평가' : `${work.rating}점`}</AppBadge>
          </ActionRow>

          <div>
            <Title order={highlight ? 3 : 4}>{work.title}</Title>
            <Text c="var(--app-text-muted)">
              {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
            </Text>
          </div>

          <Text c="var(--app-text-secondary)">
            {work.shortReview || work.description || '아직 남긴 메모가 없습니다.'}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
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
            <AppLinkButton to="/works" tone="quiet">
              작품 보기
            </AppLinkButton>
          </ActionRow>
        }
        description={
          isAuthenticated
            ? `${user?.email ?? '계정'} 아카이브를 바로 이어갈 수 있도록 검색과 최근 기록을 앞에 배치했습니다.`
            : '설명보다 검색과 최근 기록이 먼저 보이는 재진입 허브로 정리했습니다.'
        }
        eyebrow="홈"
        meta={
          <>
            <MetricPill label="전체 작품" value={`${totalCount}개`} />
            <MetricPill label="보는 중" value={`${inProgressCount}개`} />
            <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
          </>
        }
        title="다음 기록을 바로 이어가세요"
      />

      <SimpleGrid cols={{ base: 1, xl: 12 }} spacing="xl">
        <div style={{ gridColumn: 'span 7 / span 7' }}>
          <SectionCard gap="lg" tone="hero">
            <SectionIntro
              description="제목이나 작가로 찾고 바로 작품 목록이나 추가 흐름으로 이어갑니다."
              eyebrow="빠른 시작"
              title="검색에서 바로 시작"
              titleOrder={2}
            />

            <form onSubmit={handleSearchSubmit}>
              <Group align="flex-end" gap="sm" wrap="wrap">
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

            {leadRecentWork ? (
              <Paper
                p="md"
                styles={{
                  root: {
                    backgroundColor: 'var(--app-surface-1)',
                    borderColor: 'var(--app-border-color)',
                  },
                }}
                withBorder
              >
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <ArtworkPoster
                    thumbnailUrl={leadRecentWork.thumbnailUrl}
                    title={leadRecentWork.title}
                    typeLabel={getWorkTypeLabel(leadRecentWork.type)}
                    variant="row"
                  />

                  <Stack flex={1} gap="xs" miw={0}>
                    <Text c="var(--app-text-muted)" fw={700} fz="0.72rem" lts="0.12em" tt="uppercase">
                      이어보기
                    </Text>
                    <Title order={3}>{leadRecentWork.title}</Title>
                    <Text c="var(--app-text-secondary)">
                      {leadRecentWork.shortReview ||
                        leadRecentWork.description ||
                        '아직 남긴 메모가 없습니다.'}
                    </Text>
                    <ActionRow>
                      <AppLinkButton to={`/works/${leadRecentWork.id}`}>상세 열기</AppLinkButton>
                      <AppLinkButton to={`/works/${leadRecentWork.id}/edit`} tone="quiet">
                        기록 수정
                      </AppLinkButton>
                    </ActionRow>
                  </Stack>
                </Group>
              </Paper>
            ) : (
              <ActionRow>
                <AppLinkButton to="/works/new" tone="primary">
                  첫 작품 추가
                </AppLinkButton>
                <Text c="var(--app-text-muted)">
                  첫 작품을 등록하면 최근 기록이 이 자리에서 바로 이어집니다.
                </Text>
              </ActionRow>
            )}
          </SectionCard>
        </div>

        <div style={{ gridColumn: 'span 5 / span 5' }}>
          <SectionCard gap="lg" padding="lg" tone="subtle">
            <SectionIntro
              description="짧은 우회 없이 기록 관리 화면으로 이동할 수 있는 고정 경로입니다."
              eyebrow="바로 가기"
              title="자주 쓰는 흐름"
              titleOrder={2}
            />

            <Stack gap="md">
              <Paper
                component={Link}
                p="md"
                styles={{
                  root: {
                    backgroundColor: 'transparent',
                    borderColor: 'var(--app-border-color)',
                    textDecoration: 'none',
                  },
                }}
                to="/works"
                withBorder
              >
                <Stack gap={4}>
                  <Text fw={700}>작품 아카이브 열기</Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    목록 중심 작업 화면으로 바로 이동합니다.
                  </Text>
                </Stack>
              </Paper>

              <Paper
                component={Link}
                p="md"
                styles={{
                  root: {
                    backgroundColor: 'transparent',
                    borderColor: 'var(--app-border-color)',
                    textDecoration: 'none',
                  },
                }}
                to="/works/new"
                withBorder
              >
                <Stack gap={4}>
                  <Text fw={700}>검색으로 새 기록 추가</Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    후보를 선택하고 내 기록만 정리하는 흐름으로 이동합니다.
                  </Text>
                </Stack>
              </Paper>
            </Stack>

            {!error && (
              <ActionRow>
                <MetricPill label="완료" value={`${completedCount}개`} />
                <MetricPill label="진행 중" value={`${inProgressCount}개`} />
              </ActionRow>
            )}
          </SectionCard>
        </div>
      </SimpleGrid>

      <PageSection
        actions={
          <ActionRow justify="flex-end">
            <AppLinkButton to="/works">전체 작품 보기</AppLinkButton>
          </ActionRow>
        }
        description="최근 수정한 작품부터 다시 들어갈 수 있도록 한 화면에 정리했습니다."
        divider={false}
        eyebrow="최근 기록"
        title="최근 남긴 작품"
      >
        {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}

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
            description="첫 작품을 추가하면 홈에서 최근 기록과 핵심 상태를 바로 다시 볼 수 있습니다."
            title="아직 최근 기록이 없습니다."
            tone="info"
          />
        )}

        {!error && !isLoading && recentWorks.length > 0 && (
          <Paper
            p={0}
            radius="lg"
            styles={{
              root: {
                backgroundColor: 'var(--app-surface-0)',
                borderColor: 'var(--app-border-color)',
                overflow: 'hidden',
              },
            }}
            withBorder
          >
            <Stack gap={0}>
              {recentWorks.map((work, index) => (
                <RecentWorkRow
                  highlight={index === 0}
                  isLast={index === recentWorks.length - 1}
                  key={work.id}
                  work={work}
                />
              ))}
            </Stack>
          </Paper>
        )}
      </PageSection>
    </HomeHubPageTemplate>
  );
}
