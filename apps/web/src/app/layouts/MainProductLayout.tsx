import {
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Flex,
  Group,
  Menu,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
  AppNavLink,
  BrandLink,
  StateMessage,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';
import { useSyncDashboard } from '../../features/sync/hooks/useSyncDashboard';

const primaryNavigationItems = [
  { label: '홈', to: '/' },
  { label: '작품', to: '/works' },
  { label: '인사이트', to: '/insights' },
  { label: '티어 보드', to: '/tier-boards' },
] as const;

const accountNavigationItems = [
  { label: '계정', to: '/account' },
  { label: '동기화', to: '/account/sync' },
  { label: '설정', to: '/account/settings' },
] as const;

export function MainProductLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  const { isLoading, mode, signOut, user } = useAuthSession();
  const { conflictWorks, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const syncAttentionCount = conflictWorks.length + queueItems.length;

  async function handleSignOut() {
    await signOut();
    mobileMenu.close();
    navigate('/');
  }

  const syncBadge =
    syncAttentionCount > 0 ? (
      <AppBadge tone={conflictWorks.length > 0 ? 'warning' : 'accent'}>
        {syncAttentionCount}
      </AppBadge>
    ) : undefined;

  const accountBadge = !isAuthenticated ? (
    <AppBadge tone="muted">guest</AppBadge>
  ) : undefined;

  const accountMenuLabel = isAuthenticated
    ? (user?.email ?? '계정')
    : '게스트';

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap="lg">
          <header
            style={{
              borderBottom: '1px solid var(--app-border-color)',
              paddingBottom: '1rem',
            }}
          >
            <Flex
              align="center"
              gap="lg"
              justify="space-between"
              wrap="nowrap"
            >
              <Group gap="lg" miw={0} wrap="nowrap">
                <Burger
                  aria-label="주요 메뉴 열기"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                />
                <BrandLink heading="Work Archive" kicker="개인 감상 기록" />
              </Group>

              <Group
                aria-label="주요 메뉴"
                component="nav"
                gap="lg"
                visibleFrom="md"
                wrap="nowrap"
              >
                {primaryNavigationItems.map((item) => (
                  <AppNavLink end={item.to === '/'} key={item.to} to={item.to}>
                    {item.label}
                  </AppNavLink>
                ))}
              </Group>

              <Group gap="sm" justify="flex-end" wrap="nowrap">
                <Group gap="sm" visibleFrom="lg" wrap="nowrap">
                  {accountNavigationItems.map((item) => (
                    <AppNavLink
                      badge={item.to === '/account/sync' ? syncBadge : undefined}
                      end={item.to === '/account'}
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                    </AppNavLink>
                  ))}
                </Group>

                <ThemeToggleControl />
                <AppLinkButton to="/works/new" tone="primary">
                  작품 추가
                </AppLinkButton>
                {isAuthenticated && user?.email && (
                  <Text
                    c="var(--app-text-muted)"
                    maw={220}
                    size="sm"
                    truncate
                    visibleFrom="xl"
                  >
                    {user.email}
                  </Text>
                )}
                {!isAuthenticated && (
                  <Group gap="xs" visibleFrom="md" wrap="nowrap">
                    <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                    <AppLinkButton to="/auth/register" tone="quiet">
                      회원가입
                    </AppLinkButton>
                  </Group>
                )}

                <Menu position="bottom-end" shadow="md" width={260} withinPortal={false}>
                  <Menu.Target>
                    <Button aria-label={accountMenuLabel} variant="subtle">
                      {isAuthenticated ? '계정' : 'Guest'}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{accountMenuLabel}</Menu.Label>
                    <Menu.Item onClick={() => navigate('/account')}>
                      계정 센터
                    </Menu.Item>
                    <Menu.Item onClick={() => navigate('/account/sync')}>
                      동기화
                      {syncAttentionCount > 0 ? ` (${syncAttentionCount})` : ''}
                    </Menu.Item>
                    <Menu.Item onClick={() => navigate('/account/settings')}>
                      설정
                    </Menu.Item>
                    <Menu.Divider />
                    {isAuthenticated ? (
                      <Menu.Item color="red" onClick={() => void handleSignOut()}>
                        로그아웃
                      </Menu.Item>
                    ) : (
                      <>
                        <Menu.Item onClick={() => navigate('/auth/login')}>
                          로그인
                        </Menu.Item>
                        <Menu.Item onClick={() => navigate('/auth/register')}>
                          회원가입
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Flex>
          </header>

          <Drawer
            hiddenFrom="md"
            onClose={mobileMenu.close}
            opened={mobileMenuOpened}
            padding="md"
            position="left"
            title="Work Archive"
          >
            <Stack gap="lg">
              <Stack component="nav" gap={4} aria-label="모바일 주요 메뉴">
                {primaryNavigationItems.map((item) => (
                  <AppNavLink
                    end={item.to === '/'}
                    fullWidth
                    key={item.to}
                    onClick={mobileMenu.close}
                    to={item.to}
                  >
                    {item.label}
                  </AppNavLink>
                ))}
              </Stack>

              <Divider />

              <Stack gap={6}>
                <Group justify="space-between">
                  <Text c="var(--app-text-muted)" fw={700} size="sm">
                    계정과 동기화
                  </Text>
                  {accountBadge}
                </Group>
                {accountNavigationItems.map((item) => (
                  <AppNavLink
                    badge={item.to === '/account/sync' ? syncBadge : undefined}
                    end={item.to === '/account'}
                    fullWidth
                    key={item.to}
                    onClick={mobileMenu.close}
                    to={item.to}
                  >
                    {item.label}
                  </AppNavLink>
                ))}
              </Stack>

              <Divider />

              <Stack gap="sm">
                <AppLinkButton fullWidth to="/works/new" tone="primary">
                  작품 추가
                </AppLinkButton>
                <ThemeToggleControl fullWidth />
                {isAuthenticated ? (
                  <AppButtonLikeSignOut onClick={() => void handleSignOut()} />
                ) : (
                  <Group grow>
                    <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                    <AppLinkButton to="/auth/register" tone="quiet">
                      회원가입
                    </AppLinkButton>
                  </Group>
                )}
              </Stack>
            </Stack>
          </Drawer>

          {isLoading ? (
            <StateMessage
              description="잠시만 기다려주세요."
              eyebrow="로딩"
              title="Work Archive를 불러오고 있습니다"
              tone="loading"
            />
          ) : (
            <Outlet />
          )}
        </Stack>
      </Container>
    </main>
  );
}

function AppButtonLikeSignOut({ onClick }: { onClick: () => void }) {
  return (
    <Button color="red" fullWidth onClick={onClick} variant="light">
      로그아웃
    </Button>
  );
}
