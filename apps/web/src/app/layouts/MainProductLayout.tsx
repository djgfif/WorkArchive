import {
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Indicator,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
  AppNavLink,
  BrandLink,
  StateMessage,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

/* ── 페이지 전환 래퍼 ── */
function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        animation: 'pageEnter 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {children}
    </Box>
  );
}

const primaryNavigationItems = [
  { label: '홈',   to: '/' },
  { label: '작품', to: '/works' },
  { label: '설정', to: '/account/settings' },
] as const;

/* ── 프로필 아바타 버튼 ── */
function ProfileAvatarButton({
  initial,
  isAuthenticated,
  label,
}: {
  initial: string;
  isAuthenticated: boolean;
  label: string;
}) {
  return (
    <Tooltip label={label} position="bottom-end" withArrow>
      <UnstyledButton
        aria-label={`프로필: ${label}`}
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          borderRadius:    '50%',
          padding:         2,
          outline:         'none',
          transition:      'box-shadow var(--wa-motion-fast, 150ms)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2.5px var(--app-accent-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2.5px var(--app-accent-primary)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        <Avatar
          color={isAuthenticated ? 'archive' : 'gray'}
          radius="xl"
          size={34}
          variant="filled"
          style={{
            fontWeight: 800,
            fontSize:   '0.85rem',
            letterSpacing: '-0.01em',
          }}
        >
          {initial}
        </Avatar>
      </UnstyledButton>
    </Tooltip>
  );
}

export function MainProductLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const accountMenuLabel  = isAuthenticated ? (user?.email ?? '계정') : '게스트';
  const accountShortLabel = isAuthenticated
    ? (user?.email?.split('@')[0] ?? '계정')
    : '게스트';
  const avatarInitial = isAuthenticated
    ? (accountShortLabel[0] ?? 'U').toUpperCase()
    : 'G';

  async function handleSignOut() {
    await signOut();
    mobileMenu.close();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap={0}>
          {/* ══════════════════════════════════════════════════════════════
              Sticky header — 3단 grid: Left / Center / Right
              ══════════════════════════════════════════════════════════════ */}
          <Box
            className="product-header"
            component="header"
            style={{ width: '100%' }}
          >
            {/* ── Left: Burger + Brand ─────────────────────────────────── */}
            <Box className="header-left">
              <Group gap="sm" wrap="nowrap">
                <Burger
                  aria-label="메뉴 열기"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                  color="var(--app-text-secondary)"
                />
                <BrandLink heading="Work Archive" kicker="개인 감상 서재" />
              </Group>
            </Box>

            {/* ── Center: Primary nav (desktop) ────────────────────────── */}
            <Group
              aria-label="주요 탐색"
              className="header-center"
              component="nav"
              gap={2}
              visibleFrom="md"
              wrap="nowrap"
            >
              {primaryNavigationItems.map((item) => (
                <AppNavLink
                  end={item.to === '/'}
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </AppNavLink>
              ))}
            </Group>

            {/* ── Right: Add button + Profile (완전 우측 고정) ─────────── */}
            <Box className="header-right">
              {/* 작품 추가 버튼 */}
              <Box hiddenFrom="sm">
                <AppLinkButton
                  aria-label="작품 추가"
                  size="compact-sm"
                  to="/works/new"
                  tone="primary"
                >
                  + 추가
                </AppLinkButton>
              </Box>
              <Box visibleFrom="sm">
                <AppLinkButton size="sm" to="/works/new" tone="primary">
                  + 작품 추가
                </AppLinkButton>
              </Box>

              {/* Profile avatar menu (desktop) */}
              <Box visibleFrom="md">
                <Menu
                  position="bottom-end"
                  shadow="xl"
                  transitionProps={{ transition: 'pop-top-right', duration: 180 }}
                  width={280}
                >
                  <Menu.Target>
                    <Indicator
                      color={isAuthenticated ? 'teal' : 'gray'}
                      disabled={!isAuthenticated}
                      offset={3}
                      position="bottom-end"
                      size={9}
                      withBorder
                    >
                      <ProfileAvatarButton
                        initial={avatarInitial}
                        isAuthenticated={isAuthenticated}
                        label={accountMenuLabel}
                      />
                    </Indicator>
                  </Menu.Target>

                  <Menu.Dropdown
                    style={{
                      backgroundColor: 'var(--app-surface-overlay)',
                      borderColor:     'var(--app-border-default)',
                      boxShadow:       'var(--wa-shadow-overlay)',
                      backdropFilter:  'blur(20px) saturate(1.4)',
                    }}
                  >
                    {/* 계정 헤더 */}
                    <Box
                      px="sm"
                      py="sm"
                      style={{
                        borderBottom: '1px solid var(--app-border-subtle)',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <Group gap="sm" wrap="nowrap">
                        <Avatar
                          color={isAuthenticated ? 'archive' : 'gray'}
                          radius="xl"
                          size={40}
                          variant="filled"
                          style={{ fontWeight: 800, flexShrink: 0 }}
                        >
                          {avatarInitial}
                        </Avatar>
                        <Stack gap={3} miw={0} style={{ flex: 1 }}>
                          <Text fw={700} size="sm" truncate style={{ color: 'var(--app-text-primary)' }}>
                            {accountMenuLabel}
                          </Text>
                          <Group gap={6} wrap="nowrap">
                            <Box
                              style={{
                                width:        8,
                                height:       8,
                                borderRadius: '50%',
                                flexShrink:   0,
                                background:   isAuthenticated
                                  ? 'var(--app-accent-teal, #2dd4bf)'
                                  : 'var(--app-text-muted)',
                              }}
                            />
                            <Text c="dimmed" size="xs" truncate>
                              {isAuthenticated
                                ? '로그인됨'
                                : '게스트 — 이 기기에만 저장됩니다'}
                            </Text>
                          </Group>
                        </Stack>
                      </Group>
                    </Box>

                    <Menu.Item
                      leftSection={<Text size="sm">👤</Text>}
                      onClick={() => navigate('/account')}
                    >
                      계정 개요
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<Text size="sm">⚙️</Text>}
                      onClick={() => navigate('/account/settings')}
                    >
                      설정과 백업
                    </Menu.Item>

                    <Box px="xs" py="xs">
                      <ThemeToggleControl fullWidth />
                    </Box>

                    <Menu.Divider />

                    {isAuthenticated ? (
                      <Menu.Item
                        color="red"
                        leftSection={<Text size="sm">↩</Text>}
                        onClick={() => void handleSignOut()}
                      >
                        로그아웃
                      </Menu.Item>
                    ) : (
                      <>
                        <Menu.Item
                          fw={700}
                          leftSection={<Text size="sm">🔑</Text>}
                          onClick={() => navigate('/auth/login')}
                        >
                          로그인
                        </Menu.Item>
                        <Menu.Item
                          c="dimmed"
                          leftSection={<Text size="sm">✏️</Text>}
                          onClick={() => navigate('/auth/register')}
                        >
                          회원가입
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Box>
            </Box>
          </Box>

          {/* ── Page content ─────────────────────────────────────────────── */}
          <PageTransitionWrapper key={location.pathname}>
            {isLoading ? (
              <StateMessage
                description="개인 기록을 불러오는 동안 잠시만 기다려주세요."
                eyebrow="불러오는 중"
                title="Work Archive를 준비하고 있습니다"
                tone="loading"
              />
            ) : (
              <Outlet />
            )}
          </PageTransitionWrapper>
        </Stack>
      </Container>

      {/* ══════════════════════════════════════════════════════════════════
          Mobile drawer
          ══════════════════════════════════════════════════════════════════ */}
      <Drawer
        hiddenFrom="md"
        onClose={mobileMenu.close}
        opened={mobileMenuOpened}
        padding="md"
        position="left"
        size="xs"
        title={<BrandLink heading="Work Archive" kicker="개인 감상 서재" />}
        styles={{
          content: {
            backgroundColor: 'var(--app-surface-card)',
            backdropFilter:  'blur(20px)',
          },
          header: {
            backgroundColor: 'var(--app-surface-card)',
            borderBottom:    '1px solid var(--app-border-subtle)',
          },
          overlay: {
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        <Stack gap="lg" h="100%">
          {/* Navigation */}
          <Stack component="nav" gap={4} aria-label="모바일 탐색">
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

          <Divider color="var(--app-border-subtle)" />

          {/* Account section */}
          <Stack gap="sm">
            <Group
              gap="sm"
              wrap="nowrap"
              style={{
                padding:      '0.75rem',
                borderRadius: 'var(--mantine-radius-lg)',
                background:   'var(--app-surface-subtle)',
                border:       '1px solid var(--app-border-subtle)',
              }}
            >
              <Avatar
                color={isAuthenticated ? 'archive' : 'gray'}
                radius="xl"
                size={40}
                variant="filled"
                style={{ fontWeight: 800, flexShrink: 0 }}
              >
                {avatarInitial}
              </Avatar>
              <Stack gap={2} miw={0} style={{ flex: 1 }}>
                <Text fw={700} size="sm" truncate style={{ color: 'var(--app-text-primary)' }}>
                  {accountMenuLabel}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
                    {isAuthenticated ? '로그인' : '게스트'}
                  </AppBadge>
                </Group>
              </Stack>
            </Group>

            <AppLinkButton fullWidth onClick={mobileMenu.close} to="/works/new" tone="primary">
              + 작품 추가
            </AppLinkButton>

            <ThemeToggleControl fullWidth />

            {isAuthenticated ? (
              <>
                <AppLinkButton fullWidth onClick={mobileMenu.close} to="/account">
                  계정 개요
                </AppLinkButton>
                <AppLinkButton fullWidth onClick={mobileMenu.close} to="/account/settings">
                  설정과 백업
                </AppLinkButton>
                <Button
                  color="red"
                  fullWidth
                  onClick={() => void handleSignOut()}
                  variant="light"
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Group grow>
                <AppLinkButton onClick={mobileMenu.close} to="/auth/login" tone="primary">
                  로그인
                </AppLinkButton>
                <AppLinkButton onClick={mobileMenu.close} to="/auth/register" tone="quiet">
                  회원가입
                </AppLinkButton>
              </Group>
            )}
          </Stack>
        </Stack>
      </Drawer>
    </main>
  );
}
