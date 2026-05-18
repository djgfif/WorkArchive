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

const accountNavigationItems = [
  { label: '계정', to: '/account' },
  { label: '설정', to: '/account/settings' },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const sessionBadge = (
    <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
      {isAuthenticated ? '로그인됨' : '게스트'}
    </AppBadge>
  );

  const accountSummary = isAuthenticated
    ? (user?.email ?? '계정')
    : '이 기기에 저장 중';

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
  variant: 'desktop' | 'mobile';
}

function AccountNavigationCard({
  accountSummary,
  isAuthenticated,
  onSignOut,
  sessionBadge,
  variant,
}: AccountNavigationCardProps) {
  const isMobile = variant === 'mobile';

  return (
    <SectionCard gap="lg" tone="subtle">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <BrandLink heading="계정" kicker="설정과 백업" />
        {sessionBadge}
      </Group>

      <SectionIntro
        description="기록은 이 기기에 먼저 남고, 로그인하면 백업이 조용히 따라갑니다."
        eyebrow={isAuthenticated ? '로그인됨' : '게스트 모드'}
        title="내 기록 보관함"
      />

      <Stack gap={4}>
        <Text c="dimmed" fw={700} size="sm">
          현재 상태
        </Text>
        <Text fw={600} truncate>
          {accountSummary}
        </Text>
      </Stack>

      {isMobile ? (
        <SimpleGrid
          component="nav"
          cols={{ base: 1, xs: 2 }}
          spacing="xs"
          aria-label="계정 내비게이션"
        >
          {accountNavigationItems.map((item) => (
            <AppNavLink
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
        <Stack component="nav" gap="xs" aria-label="계정 내비게이션">
          {accountNavigationItems.map((item) => (
            <AppNavLink
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
          <AppLinkButton fullWidth to="/works">
            작품
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
          <AppLinkButton to="/works">작품</AppLinkButton>
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
