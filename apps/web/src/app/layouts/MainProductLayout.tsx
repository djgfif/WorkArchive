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
  { label: '작품 추가', to: '/works/new' },
  { label: '설정', to: '/account/settings' },
] as const;

export function MainProductLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const accountMenuLabel = isAuthenticated
    ? (user?.email ?? '계정')
    : '게스트';

  async function handleSignOut() {
    await signOut();
    mobileMenu.close();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap="lg">
          <Box
            className="product-header"
            component="header"
            pb="md"
          >
            <Flex align="center" gap="lg" justify="space-between" wrap="nowrap">
              <Group gap="lg" miw={0} wrap="nowrap">
                <Burger
                  aria-label="Open navigation"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                />
                <BrandLink heading="Work Archive" kicker="Personal media archive" />
              </Group>

              <Group
                aria-label="Primary navigation"
                component="nav"
                gap="lg"
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

              <Group gap="sm" justify="flex-end" wrap="nowrap">
                <Box visibleFrom="md">
                  <ThemeToggleControl />
                </Box>
                <Box hiddenFrom="sm">
                  <AppLinkButton
                    aria-label="작품 추가"
                    size="compact-sm"
                    to="/works/new"
                    tone="primary"
                  >
                    추가
                  </AppLinkButton>
                </Box>
                <Box visibleFrom="sm">
                  <AppLinkButton to="/works/new" tone="primary">
                    작품 추가
                  </AppLinkButton>
                </Box>
                {!isAuthenticated && (
                  <Group gap="xs" visibleFrom="md" wrap="nowrap">
                    <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                    <AppLinkButton to="/auth/register" tone="quiet">
                      회원가입
                    </AppLinkButton>
                  </Group>
                )}

                <Box visibleFrom="md">
                  <Menu position="bottom-end" shadow="md" width={240} withinPortal={false}>
                    <Menu.Target>
                      <Button aria-label={accountMenuLabel} variant="subtle">
                        {accountMenuLabel}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>{accountMenuLabel}</Menu.Label>
                      <Menu.Item onClick={() => navigate('/account')}>
                        계정
                      </Menu.Item>
                      <Menu.Item onClick={() => navigate('/account/settings')}>
                        설정과 백업
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
                </Box>
              </Group>
            </Flex>
          </Box>

          <Drawer
            hiddenFrom="md"
            onClose={mobileMenu.close}
            opened={mobileMenuOpened}
            padding="md"
            position="left"
            title="Work Archive"
          >
            <Stack gap="lg">
              <Stack component="nav" gap={4} aria-label="Mobile navigation">
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

              <Stack gap="sm">
                <Group justify="space-between">
                  <Text c="dimmed" fw={700} size="sm">
                    계정
                  </Text>
                  {!isAuthenticated && <AppBadge tone="muted">게스트</AppBadge>}
                </Group>
                <AppLinkButton fullWidth to="/works/new" tone="primary">
                  작품 추가
                </AppLinkButton>
                <ThemeToggleControl fullWidth />
                {isAuthenticated ? (
                  <Button color="red" fullWidth onClick={() => void handleSignOut()} variant="light">
                    로그아웃
                  </Button>
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
              description="Please wait while your archive is prepared."
              eyebrow="불러오는 중"
              title="Work Archive를 준비하고 있습니다"
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
