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
  { label: 'Account', to: '/account' },
  { label: 'Settings', to: '/account/settings' },
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
      {isAuthenticated ? 'signed in' : 'guest'}
    </AppBadge>
  );

  const accountSummary = isAuthenticated
    ? (user?.email ?? 'Account')
    : 'Stored on this device';

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
              <LoadingState rows={2} title="Preparing account settings" />
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
        <BrandLink heading="Account" kicker="Settings and backup" />
        {sessionBadge}
      </Group>

      <SectionIntro
        description="Account, local backup, and appearance settings are grouped here. Sync runs quietly in the background when you are signed in."
        eyebrow={isAuthenticated ? 'Signed in' : 'Guest mode'}
        title="Settings and local backup"
      />

      <Stack gap={4}>
        <Text c="dimmed" fw={700} size="sm">
          Current session
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
          aria-label="Account navigation"
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
        <Stack component="nav" gap="xs" aria-label="Account navigation">
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
          aria-label="Account quick actions"
          cols={{ base: 1, xs: 3 }}
          role="group"
          spacing="xs"
        >
          <ThemeToggleControl fullWidth />
          <AppLinkButton fullWidth to="/works">
            Works
          </AppLinkButton>
          {isAuthenticated ? (
            <AppButton fullWidth onClick={onSignOut} tone="quiet" type="button">
              Log out
            </AppButton>
          ) : (
            <AppLinkButton fullWidth to="/auth/login" tone="primary">
              Log in
            </AppLinkButton>
          )}
        </SimpleGrid>
      ) : (
        <ActionRow>
          <ThemeToggleControl />
          <AppLinkButton to="/works">Works</AppLinkButton>
          {isAuthenticated ? (
            <AppButton onClick={onSignOut} tone="quiet" type="button">
              Log out
            </AppButton>
          ) : (
            <AppLinkButton to="/auth/login" tone="primary">
              Log in
            </AppLinkButton>
          )}
        </ActionRow>
      )}
    </SectionCard>
  );
}
