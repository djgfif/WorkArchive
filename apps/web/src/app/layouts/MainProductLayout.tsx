import {
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
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

const primaryNavigationItems = [
  { label: '홈', to: '/' },
  { label: '작품', to: '/works' },
  { label: '설정', to: '/account/settings' },
] as const;

export function MainProductLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const accountMenuLabel = isAuthenticated ? (user?.email ?? '계정') : '게스트';
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
          {/* ── Sticky header — 3단 구조: Left / Center / Right ─────────── */}
          <Box
            className="product-header"
            component="header"
            style={{ width: '100%' }}
          >
            {/* Left: burger + brand */}
            <Box className="header-left">
              <Group gap="sm" wrap="nowrap">
                <Burger
                  aria-label="메뉴 열기"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                />
                <BrandLink heading="Work Archive" kicker="개인 감상 서재" />
              </Group>
            </Box>

            {/* Center: primary nav (desktop only) */}
            <Group
              aria-label="주요 탐색"
              className="header-center"
              component="nav"
              gap={4}
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

            {/* Right: add button + profile avatar (always right-aligned) */}
            <Box className="header-right">
              <Group gap="sm" wrap="nowrap">
                {/* 작품 추가 버튼 */}
                <Box hiddenFrom="sm">
                  <Tooltip label="작품 추가" position="bottom">
                    <AppLinkButton
                      aria-label="작품 추가"
                      size="compact-sm"
                      to="/works/new"
                      tone="primary"
                    >
                      + 추가
                    </AppLinkButton>
                  </Tooltip>
                </Box>
                <Box visibleFrom="sm">
                  <AppLinkButton to="/works/new" tone="primary">
                    + 작품 추가
                  </AppLinkButton>
                </Box>

                {/* Profile avatar menu (desktop) — 완전 우측 고정 */}
                <Box visibleFrom="md">
                  <Menu
                    position="bottom-end"
                    shadow="lg"
                    transitionProps={{ transition: 'pop-top-right', duration: 160 }}
                    width={272}
                  >
                    <Menu.Target>
                      <Tooltip label={accountMenuLabel} position="bottom-end">
                        <UnstyledButton
                          aria-label={`프로필: ${accountMenuLabel}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            padding: 2,
                            transition: 'box-shadow 140ms ease, opacity 140ms ease',
                          }}
                          styles={{
                            root: {
                              '&:hover': {
                                boxShadow: '0 0 0 2px var(--app-accent-primary)',
                                opacity: 0.9,
                              },
                            },
                          } as Record<string, unknown>}
                        >
                          <Avatar
                            color={isAuthenticated ? 'archive' : 'gray'}
                            radius="xl"
                            size={34}
                            variant="filled"
                          >
                            <Text fw={800} size="sm">
                              {avatarInitial}
                            </Text>
                          </Avatar>
                        </UnstyledButton>
                      </Tooltip>
                    </Menu.Target>

                    <Menu.Dropdown
                      style={{
                        backgroundColor: 'var(--app-surface-card)',
                        borderColor: 'var(--app-border-subtle)',
                        boxShadow: 'var(--app-shadow-overlay)',
                      }}
                    >
                      {/* 계정 헤더 */}
                      <Box px="sm" py="xs">
                        <Group gap="xs" wrap="nowrap">
                          <Avatar
                            color={isAuthenticated ? 'archive' : 'gray'}
                            radius="xl"
                            size={36}
                            variant="filled"
                          >
                            <Text fw={800} size="sm">
                              {avatarInitial}
                            </Text>
                          </Avatar>
                          <Stack gap={2} miw={0} style={{ flex: 1 }}>
                            <Text fw={700} size="sm" truncate>
                              {accountMenuLabel}
                            </Text>
                            <Text c="dimmed" size="xs">
                              {isAuthenticated
                                ? '로그인됨'
                                : '게스트 — 이 기기에만 저장됩니다'}
                            </Text>
                          </Stack>
                        </Group>
                      </Box>

                      <Menu.Divider />

                      <Menu.Item onClick={() => navigate('/account')}>
                        계정 개요
                      </Menu.Item>
                      <Menu.Item onClick={() => navigate('/account/settings')}>
                        설정과 백업
                      </Menu.Item>

                      <Box px="xs" py={4}>
                        <ThemeToggleControl fullWidth />
                      </Box>

                      <Menu.Divider />

                      {isAuthenticated ? (
                        <Menu.Item color="red" onClick={() => void handleSignOut()}>
                          로그아웃
                        </Menu.Item>
                      ) : (
                        <>
                          <Menu.Item
                            fw={700}
                            onClick={() => navigate('/auth/login')}
                          >
                            로그인
                          </Menu.Item>
                          <Menu.Item
                            c="dimmed"
                            onClick={() => navigate('/auth/register')}
                          >
                            회원가입
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Box>
              </Group>
            </Box>
          </Box>

          {/* ── Page content ───────────────────────────────────────────── */}
          <Box>
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
          </Box>
        </Stack>
      </Container>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <Drawer
        hiddenFrom="md"
        onClose={mobileMenu.close}
        opened={mobileMenuOpened}
        padding="md"
        position="left"
        size="xs"
        title={
          <BrandLink heading="Work Archive" kicker="개인 감상 서재" />
        }
        styles={{
          content: {
            backgroundColor: 'var(--app-surface-card)',
          },
          header: {
            backgroundColor: 'var(--app-surface-card)',
            borderBottom: '1px solid var(--app-border-subtle)',
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
            <Group gap="xs" wrap="nowrap">
              <Avatar
                color={isAuthenticated ? 'archive' : 'gray'}
                radius="xl"
                size={36}
                variant="filled"
              >
                <Text fw={800} size="sm">
                  {avatarInitial}
                </Text>
              </Avatar>
              <Stack gap={1} miw={0} style={{ flex: 1 }}>
                <Text fw={700} size="sm" truncate>
                  {accountMenuLabel}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <AppBadge tone={isAuthenticated ? 'accent' : 'muted'}>
                    {isAuthenticated ? '로그인' : '게스트'}
                  </AppBadge>
                  {!isAuthenticated && (
                    <Text c="dimmed" size="xs" truncate>
                      이 기기에만 저장됩니다
                    </Text>
                  )}
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
