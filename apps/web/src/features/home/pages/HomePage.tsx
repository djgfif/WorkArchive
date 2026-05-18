import { useState, type FormEvent } from 'react';
import { Grid, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link, useNavigate } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  LoadingRows,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { HomeHubPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import {
  formatWorkDate,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

function getProgressSummary(work: WorkRecord) {
  if (work.lastConsumedLabel) {
    return work.lastConsumedLabel;
  }

  if (work.progressCurrent !== null && work.progressTotal !== null) {
    return `${work.progressCurrent}/${work.progressTotal}`;
  }

  if (work.progressCurrent !== null) {
    return `${work.progressCurrent}까지`;
  }

  return '진행도 없음';
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
          backgroundColor: highlight ? 'var(--mantine-color-default)' : 'transparent',
          border: 'none',
          borderBottom: isLast ? 'none' : '1px solid var(--mantine-color-default-border)',
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
            <AppBadge tone="muted">{getProgressSummary(work)}</AppBadge>
          </ActionRow>

          <div>
            <Title order={highlight ? 3 : 4}>{work.title}</Title>
            <Text c="var(--mantine-color-dimmed)">
              {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
            </Text>
          </div>

          <Text c="var(--mantine-color-text)">
            {work.shortReview || work.description || '아직 남긴 메모가 없습니다.'}
          </Text>
          <Text c="var(--mantine-color-dimmed)" size="sm">
            마지막 감상 {formatWorkDate(work.lastConsumedAt)}
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
    retry,
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

  const hasRecentWorks = recentWorks.length > 0;

  return (
    <HomeHubPageTemplate>
      <SectionCard gap="lg" padding="xl" tone="hero">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap="xs">
            <Text c="var(--mantine-color-dimmed)" fw={700} fz="0.72rem" lts="0.12em" tt="uppercase">
              Local archive
            </Text>
            <Title order={1}>기록 홈</Title>
            <Text c="var(--mantine-color-text)">
              {isAuthenticated
                ? `${user?.email ?? '계정'}의 개인 기록 저장소`
                : '이 기기에 먼저 저장되는 개인 기록 저장소'}
            </Text>
          </Stack>

          <ActionRow justify="flex-end">
            <AppLinkButton to="/works/new" tone="primary">
              작품 추가
            </AppLinkButton>
            <AppLinkButton to="/works" tone="quiet">
              작품 보기
            </AppLinkButton>
          </ActionRow>
        </Group>

        <form onSubmit={handleSearchSubmit}>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              aria-label="작품 검색"
              flex={1}
              miw={260}
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
              placeholder="제목, 작가, 제작자 검색"
              value={searchTerm}
            />
            <AppButton tone="primary" type="submit">
              검색
            </AppButton>
          </Group>
        </form>

        <ActionRow>
          <MetricPill label="전체" value={`${totalCount}개`} />
          <MetricPill label="진행 중" value={`${inProgressCount}개`} />
          <MetricPill label="완료" value={`${completedCount}개`} />
          <MetricPill label="평균" value={formatAverageRating(averageRating)} />
        </ActionRow>
      </SectionCard>

      <Grid align="start" gutter="xl">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <SectionCard gap="lg" padding="lg" tone="default">
            <Group align="flex-start" justify="space-between" wrap="wrap">
              <SectionIntro eyebrow="최근 기록" title="최근 수정한 작품" titleOrder={2} />
              <AppLinkButton to="/works" tone="quiet">
                전체 보기
              </AppLinkButton>
            </Group>

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

            {!error && isLoading && (
              <LoadingRows rows={3} />
            )}

            {!error && !isLoading && !hasRecentWorks && (
              <StateMessage
                actions={
                  <AppLinkButton to="/works/new" tone="primary">
                    작품 추가
                  </AppLinkButton>
                }
                description="첫 기록을 만들면 최근 작품이 여기에 표시됩니다."
                title="최근 기록 없음"
                tone="info"
              />
            )}

            {!error && !isLoading && hasRecentWorks && (
              <Paper
                p={0}
                radius="md"
                styles={{
                  root: {
                    backgroundColor: 'var(--mantine-color-default-hover)',
                    borderColor: 'var(--mantine-color-default-border)',
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
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Stack gap="xl">
            <SectionCard gap="lg" padding="lg" tone="subtle">
              <SectionIntro eyebrow="이어가기" title="마지막 기록" titleOrder={2} />

              {leadRecentWork ? (
                <Paper
                  component={Link}
                  p="md"
                  styles={{
                    root: {
                      backgroundColor: 'var(--mantine-color-default)',
                      borderColor: 'var(--mantine-color-default-border)',
                      textDecoration: 'none',
                    },
                  }}
                  to={`/works/${leadRecentWork.id}`}
                  withBorder
                >
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    <ArtworkPoster
                      thumbnailUrl={leadRecentWork.thumbnailUrl}
                      title={leadRecentWork.title}
                      typeLabel={getWorkTypeLabel(leadRecentWork.type)}
                      variant="row"
                    />

                    <Stack flex={1} gap={4} miw={0}>
                      <Text fw={700}>{leadRecentWork.title}</Text>
                      <Text c="var(--mantine-color-dimmed)" size="sm">
                        {getWorkStatusLabel(leadRecentWork.status)} ·{' '}
                        {getProgressSummary(leadRecentWork)} ·{' '}
                        마지막 감상 {formatWorkDate(leadRecentWork.lastConsumedAt)}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ) : (
                <Text c="var(--mantine-color-dimmed)">최근 수정한 작품이 없습니다.</Text>
              )}
            </SectionCard>

            <SectionCard gap="lg" padding="lg" tone="subtle">
              <SectionIntro eyebrow="상태" title="아카이브 요약" titleOrder={2} />
              <Stack gap="sm">
                <MetricPill label="전체 작품" value={`${totalCount}개`} />
                <MetricPill label="보는 중" value={`${inProgressCount}개`} />
                <MetricPill label="완료" value={`${completedCount}개`} />
                <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
              </Stack>
            </SectionCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </HomeHubPageTemplate>
  );
}
