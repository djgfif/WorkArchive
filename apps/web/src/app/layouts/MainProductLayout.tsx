import {
  Avatar,
  Box,
  Burger,
  Container,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
  AppNavLink,
  BrandLink,
  StateMessage,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import {
  featureFlags,
  type FeatureFlags,
} from '../../shared/runtime/feature-flags';
import { useAuthSession } from '../../features/auth';
import { getUserAvatarProfile } from '../../features/auth';

export function getPrimaryNavigationItems(flags: FeatureFlags = featureFlags) {
  return [
    { label: '홈', to: '/' },
    { label: '작품', to: '/works' },
    ...(flags.tierBoards ? [{ label: '티어보드', to: '/tier-boards' }] : []),
  ] as const;
}

export function MainProductLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;
  const avatarProfile = getUserAvatarProfile(isAuthenticated ? user : null);
  const accountLabel = isAuthenticated ? avatarProfile.displayName : '게스트';
  const avatarInitial = isAuthenticated ? avatarProfile.initial : 'G';
  const avatarImageUrl = isAuthenticated ? avatarProfile.imageUrl : '';
  const accountMenuLabel = isAuthenticated
    ? `계정 메뉴: ${accountLabel}, ${avatarProfile.email}`
    : `계정 메뉴: ${accountLabel}`;
  const primaryNavigationItems = getPrimaryNavigationItems();

  async function handleSignOut() {
    await signOut();
    mobileMenu.close();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap={0}>
          <Box className="product-header" component="header">
            <Box className="header-left">
              <Group gap="sm" wrap="nowrap">
                <Burger
                  aria-label="메뉴 열기"
                  hiddenFrom="md"
                  onClick={mobileMenu.open}
                  opened={mobileMenuOpened}
                  size="sm"
                />
                <BrandLink heading="Work Archive" kicker="개인 감상 아카이브" />
              </Group>
            </Box>

            <Group
              aria-label="주요 탐색"
              className="header-center"
              component="nav"
              gap={2}
              visibleFrom="md"
              wrap="nowrap"
            >
              {primaryNavigationItems.map((item) => (
                <AppNavLink end={item.to === '/'} key={item.to} to={item.to}>
                  {item.label}
                </AppNavLink>
              ))}
            </Group>

            <Box className="header-right">
              <Menu position="bottom-end" shadow="xl" width={280}>
                <Menu.Target>
                  <button
                    aria-label={accountMenuLabel}
                    style={{
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    type="button"
                  >
                    <Avatar
                      color={isAuthenticated ? 'archive' : 'gray'}
                      radius="xl"
                      size={34}
                      src={avatarImageUrl || null}
                    >
                      {avatarInitial}
                    </Avatar>
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{accountLabel}</Menu.Label>
                  {isAuthenticated && (
                    <Menu.Label>{avatarProfile.email}</Menu.Label>
                  )}
                  <Menu.Item onClick={() => navigate('/account')}>
                    계정 개요
                  </Menu.Item>
                  <Menu.Item onClick={() => navigate('/account/settings')}>
                    설정과 백업
                  </Menu.Item>
                  {isAuthenticated ? (
                    <Menu.Item color="red" onClick={() => void handleSignOut()}>
                      로그아웃
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      onClick={() =>
                        navigate('/auth/login', {
                          state: { returnTo: loginReturnTo },
                        })
                      }
                    >
                      로그인
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Box>
          </Box>

          <Box className="page-transition">
            {isLoading ? (
              <StateMessage
                description="개인 기록을 불러오는 동안 잠시만 기다려 주세요."
                eyebrow="Loading"
                title="Work Archive를 준비하고 있습니다"
                tone="loading"
              />
            ) : (
              <Outlet />
            )}
          </Box>
        </Stack>
      </Container>

      <Drawer
        hiddenFrom="md"
        onClose={mobileMenu.close}
        opened={mobileMenuOpened}
        padding="md"
        position="left"
        size="xs"
        title={<BrandLink heading="Work Archive" kicker="개인 감상 아카이브" />}
      >
        <Stack gap="lg" h="100%">
          <Stack aria-label="모바일 탐색" component="nav" gap={4}>
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
          <AppLinkButton
            fullWidth
            onClick={mobileMenu.close}
            to="/works/new"
            tone="primary"
          >
            작품 추가
          </AppLinkButton>
          <Group gap="sm" wrap="nowrap">
            <Avatar
              color={isAuthenticated ? 'archive' : 'gray'}
              radius="xl"
              size={40}
              src={avatarImageUrl || null}
            >
              {avatarInitial}
            </Avatar>
            <Stack gap={2}>
              <Text fw={700} size="sm">
                {accountLabel}
              </Text>
              <Text c="dimmed" size="xs">
                {isAuthenticated ? '로그인됨' : '게스트 모드'}
              </Text>
            </Stack>
          </Group>
          <ThemeToggleControl fullWidth />
          {isAuthenticated ? (
            <Stack gap="xs">
              <AppLinkButton
                fullWidth
                onClick={mobileMenu.close}
                to="/account"
                tone="secondary"
              >
                계정 개요
              </AppLinkButton>
              <AppLinkButton
                fullWidth
                onClick={mobileMenu.close}
                to="/account/settings"
                tone="secondary"
              >
                설정과 백업
              </AppLinkButton>
              <AppButton
                fullWidth
                onClick={() => void handleSignOut()}
                tone="quiet"
                type="button"
              >
                로그아웃
              </AppButton>
            </Stack>
          ) : (
            <AppLinkButton
              fullWidth
              onClick={mobileMenu.close}
              state={{ returnTo: loginReturnTo }}
              to="/auth/login"
              tone="primary"
            >
              로그인
            </AppLinkButton>
          )}
        </Stack>
      </Drawer>
    </main>
  );
}
