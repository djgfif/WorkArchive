import { useState, type FormEvent } from 'react';
import {
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
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
  ArchiveStarterShelf,
  WorkShelf,
} from '../../works/components/ArchiveComponents';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `★ ${value.toFixed(1)}`;
}

interface QuickStatProps {
  accent?: boolean;
  icon: string;
  label: string;
  value: string;
}

function QuickStat({ accent = false, icon, label, value }: QuickStatProps) {
  return (
    <Paper
      p="md"
      radius="lg"
      styles={{
        root: {
          background: accent
            ? 'linear-gradient(135deg, var(--app-surface-hero), var(--app-bg-elevated))'
            : 'var(--app-surface-subtle)',
          borderColor: accent ? 'var(--app-border-strong)' : 'var(--app-border-subtle)',
          transition: 'border-color 160ms ease',
        },
      }}
      withBorder
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          color={accent ? 'archive' : 'gray'}
          radius="md"
          size={36}
          variant={accent ? 'gradient' : 'light'}
          {...(accent ? { gradient: { deg: 135, from: 'archive.4', to: 'archive.7' } } : {})}
        >
          <Text fw={900} size="sm">{icon}</Text>
        </ThemeIcon>
        <Stack gap={2} miw={0}>
          <Text c="dimmed" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            {label}
          </Text>
          <Text fw={800} size="lg">{value}</Text>
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
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <ArchiveHero
        actions={
          <AppLinkButton size="md" to="/works/new" tone="primary">
            + 작품 추가
          </AppLinkButton>
        }
        description={
          isAuthenticated
            ? `${user?.email ?? '내 계정'} · 개인 감상 기록 저장소`
            : '이 기기에 먼저 저장되는 개인 감상 기록 저장소'
        }
        eyebrow="개인 감상 서재"
        title="내 아카이브"
        variant="landing"
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

      {/* ── Error ──────────────────────────────────────────────────────── */}
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
              <AppLinkButton to="/works/new" tone="quiet">
                작품 추가
              </AppLinkButton>
            </>
          }
          description={error}
          title="최근 기록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {!error && isLoading && <LoadingRows rows={4} />}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {!error && !isLoading && (
        <Stack gap={48}>
          {/* Quick stats — shown prominently at top when there's data */}
          {totalCount > 0 && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <QuickStat
                accent
                icon="📚"
                label="전체 작품"
                value={`${totalCount}개`}
              />
              <QuickStat
                icon="▶"
                label="보는 중"
                value={`${inProgressCount}개`}
              />
              <QuickStat
                icon="✓"
                label="완료"
                value={`${completedCount}개`}
              />
              <QuickStat
                icon="★"
                label="평균 별점"
                value={formatAverageRating(averageRating)}
              />
            </SimpleGrid>
          )}

          {/* 이어보기 선반 */}
          <WorkShelf
            empty={<ArchiveStarterShelf />}
            title={
              <Group justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Group gap="xs" wrap="nowrap">
                    <Text c="var(--app-accent-primary)" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                      이어보기
                    </Text>
                  </Group>
                  <Title order={2}>보는 중인 작품</Title>
                  <Text c="dimmed" size="sm">
                    진행 중인 기록만 조용히 모았습니다.
                  </Text>
                </Stack>
                <AppLinkButton to="/works?status=in_progress" tone="quiet">
                  모두 보기
                </AppLinkButton>
              </Group>
            }
            works={continueWorks}
          />

          {/* 최근 손본 작품 */}
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={4}>
                <Text c="var(--app-accent-primary)" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                  최근 활동
                </Text>
                <Title order={2}>최근 손본 작품</Title>
                <Text c="dimmed" size="sm">
                  방금 손본 작품을 빠르게 다시 엽니다.
                </Text>
              </Stack>
              <AppLinkButton to="/works" tone="quiet">
                작품 목록 전체
              </AppLinkButton>
            </Group>
            {recentWorks.length > 0 ? (
              <WorkShelf works={recentWorks.slice(0, 8)} />
            ) : (
              <StateMessage
                actions={
                  <AppLinkButton to="/works/new" tone="primary">
                    첫 작품 추가
                  </AppLinkButton>
                }
                description="첫 기록을 만들면 홈에서 이어보기와 최근 수정 흐름이 시작됩니다."
                eyebrow="시작하기"
                title="아직 기록이 없습니다"
                tone="info"
              />
            )}
          </Stack>
        </Stack>
      )}
    </HomeHubPageTemplate>
  );
}
