import {
  Box,
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
  ThemeIcon,
  Tooltip,
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

  async function handleSignOut() {
    await signOut();
    mobileMenu.close();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap={0}>
          {/* ── Sticky header ──────────────────────────────────────────── */}
          <Box
            className="product-header"
            component="header"
          >
            <Flex align="center" gap="lg" justify="space-between" wrap="nowrap">
              {/* Left: burger + brand */}
              <Group gap="sm" miw={0} wrap="nowrap">
                <Burger
                  aria-label="메뉴 열기"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                />
                <BrandLink heading="Work Archive" kicker="개인 감상 서재" />
              </Group>

              {/* Center: primary nav (desktop) */}
              <Group
                aria-label="주요 탐색"
                component="nav"
                gap="xs"
                style={{ flex: '0 0 auto' }}
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

              {/* Right: add button + account menu */}
              <Group gap="sm" justify="flex-end" style={{ flex: '0 0 auto' }} wrap="nowrap">
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

                {/* Account menu (desktop) */}
                <Box visibleFrom="md">
                  <Menu
                    position="bottom-end"
                    shadow="md"
                    transitionProps={{ transition: 'pop-top-right', duration: 140 }}
                    width={240}
                    withinPortal={false}
                  >
                    <Menu.Target>
                      <Button
                        aria-label={accountMenuLabel}
                        leftSection={
                          <ThemeIcon
                            color={isAuthenticated ? 'archive' : 'gray'}
                            radius="xl"
                            size={22}
                            variant="light"
                          >
                            <Text fw={800} size="xs">
                              {isAuthenticated
                                ? (accountShortLabel[0] ?? 'U').toUpperCase()
                                : 'G'}
                            </Text>
                          </ThemeIcon>
                        }
                        size="sm"
                        variant="subtle"
                      >
                        {accountShortLabel}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>
                        <Stack gap={2}>
                          <Text fw={700} size="sm">{accountMenuLabel}</Text>
                          {!isAuthenticated && (
                            <Text c="dimmed" size="xs">로그인하면 기록이 동기화됩니다</Text>
                          )}
                        </Stack>
                      </Menu.Label>
                      <Menu.Divider />
                      <Menu.Item onClick={() => navigate('/account')}>
                        계정 개요
                      </Menu.Item>
                      <Menu.Item onClick={() => navigate('/account/settings')}>
                        설정과 백업
                      </Menu.Item>
                      <Box p="xs">
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
            </Flex>
          </Box>

          {/* ── Page content ───────────────────────────────────────────── */}
          <Box pt="lg">
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

          <Divider />

          {/* Account section */}
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={2} miw={0}>
                <Text fw={700} size="sm" truncate>
                  {accountMenuLabel}
                </Text>
                {!isAuthenticated && (
                  <Text c="dimmed" size="xs">
                    게스트 모드 — 이 기기에만 저장됩니다
                  </Text>
                )}
              </Stack>
              <AppBadge tone={isAuthenticated ? 'accent' : 'muted'}>
                {isAuthenticated ? '로그인' : '게스트'}
              </AppBadge>
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
