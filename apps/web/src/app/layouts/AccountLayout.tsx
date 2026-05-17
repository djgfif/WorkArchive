import { Box, Container, Grid, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  AppNavLink,
  BrandLink,
  LoadingState,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';
import { useSyncDashboard } from '../../features/sync/hooks/useSyncDashboard';

const accountNavigationItems = [
  { label: '계정 홈', to: '/account' },
  { label: '동기화', to: '/account/sync' },
  { label: '설정', to: '/account/settings' },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const { conflictWorks, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const syncAttentionCount = conflictWorks.length + queueItems.length;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const syncBadge =
    syncAttentionCount > 0 ? (
      <AppBadge tone={conflictWorks.length > 0 ? 'warning' : 'accent'}>
        {syncAttentionCount}
      </AppBadge>
    ) : undefined;

  const sessionBadge = (
    <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
      {isAuthenticated ? '로그인됨' : '게스트'}
    </AppBadge>
  );

  const accountSummary = isAuthenticated
    ? (user?.email ?? '계정')
    : '로컬 기기에만 저장 중';

  return (
    <main className="layout-shell layout-shell--account">
      <Container px="md" size={1360}>
        <Grid align="start" gutter="xl">
          <Grid.Col hiddenFrom="lg" span={12}>
            <AccountNavigationCard
              accountSummary={accountSummary}
              isAuthenticated={isAuthenticated}
              onSignOut={() => void handleSignOut()}
              sessionBadge={sessionBadge}
              syncBadge={syncBadge}
              variant="mobile"
            />
          </Grid.Col>

          <Grid.Col span={3} visibleFrom="lg">
            <Box pos="sticky" top={24}>
              <AccountNavigationCard
                accountSummary={accountSummary}
                isAuthenticated={isAuthenticated}
                onSignOut={() => void handleSignOut()}
                sessionBadge={sessionBadge}
                syncBadge={syncBadge}
                variant="desktop"
              />
            </Box>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 9 }}>
            {isLoading ? (
              <LoadingState rows={2} title="계정 설정을 준비하고 있습니다" />
            ) : (
              <Outlet />
            )}
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}

interface AccountNavigationCardProps {
  accountSummary: string;
  isAuthenticated: boolean;
  onSignOut: () => void;
  sessionBadge: ReactNode;
  syncBadge?: ReactNode;
  variant: 'desktop' | 'mobile';
}

function AccountNavigationCard({
  accountSummary,
  isAuthenticated,
  onSignOut,
  sessionBadge,
  syncBadge,
  variant,
}: AccountNavigationCardProps) {
  const isMobile = variant === 'mobile';

  return (
    <SectionCard gap="lg" tone="subtle">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <BrandLink heading="계정 센터" kicker="관리 맥락" />
        {sessionBadge}
      </Group>

      <SectionIntro
        description={
          isAuthenticated
            ? '계정 정보, 동기화 상태, 데이터 설정을 작품 관리 흐름과 분리해 관리합니다.'
            : '로그인하면 계정 기반 동기화와 설정을 이 영역에서 사용할 수 있습니다.'
        }
        eyebrow={isAuthenticated ? '관리 화면' : '게스트 모드'}
        title={isAuthenticated ? '계정과 동기화 관리' : '계정 기능 안내'}
      />

      <Stack gap={4}>
        <Text c="var(--app-text-muted)" fw={700} size="sm">
          현재 세션
        </Text>
        <Text c="var(--app-text-strong)" fw={600} truncate>
          {accountSummary}
        </Text>
      </Stack>

      {isMobile ? (
        <SimpleGrid component="nav" cols={{ base: 1, xs: 3 }} spacing="xs" aria-label="계정 메뉴">
          {accountNavigationItems.map((item) => (
            <AppNavLink
              badge={item.to === '/account/sync' ? syncBadge : undefined}
              end={item.to === '/account'}
              fullWidth
              key={item.to}
              to={item.to}
            >
              {item.label}
            </AppNavLink>
          ))}
        </SimpleGrid>
      ) : (
        <Stack component="nav" gap="xs" aria-label="계정 메뉴">
          {accountNavigationItems.map((item) => (
            <AppNavLink
              badge={item.to === '/account/sync' ? syncBadge : undefined}
              end={item.to === '/account'}
              fullWidth
              key={item.to}
              to={item.to}
            >
              {item.label}
            </AppNavLink>
          ))}
        </Stack>
      )}

      {isMobile ? (
        <SimpleGrid
          aria-label="계정 빠른 작업"
          cols={{ base: 1, xs: 3 }}
          role="group"
          spacing="xs"
        >
          <ThemeToggleControl fullWidth />
          <AppLinkButton fullWidth to="/profile">
            기록 요약
          </AppLinkButton>
          {isAuthenticated ? (
            <AppButton fullWidth onClick={onSignOut} tone="quiet" type="button">
              로그아웃
            </AppButton>
          ) : (
            <AppLinkButton fullWidth to="/auth/login" tone="primary">
              로그인
            </AppLinkButton>
          )}
        </SimpleGrid>
      ) : (
        <ActionRow>
          <ThemeToggleControl />
          <AppLinkButton to="/profile">기록 요약</AppLinkButton>
          {isAuthenticated ? (
            <AppButton onClick={onSignOut} tone="quiet" type="button">
              로그아웃
            </AppButton>
          ) : (
            <AppLinkButton to="/auth/login" tone="primary">
              로그인
            </AppLinkButton>
          )}
        </ActionRow>
      )}
    </SectionCard>
  );
}
