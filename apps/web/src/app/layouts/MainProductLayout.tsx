import {
  Avatar,
  Box,
  Burger,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
  AppNavLink,
  StateMessage,
  ThemeToggleControl,
} from '@shared/components/AppPrimitives';
import { getUserAvatarProfile, useAuthSession } from '@features/auth';
import { SyncSafetyBadge } from '@features/sync';
import { getPrimaryNavigationItems } from './navigation';
import styles from './MainProductLayout.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined): string {
  return value ?? '';
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
    <div className="app-frame">
      {/* ── TopNav ── */}
      <header className={cn(css.topnav)} role="banner">
        <div className={cn(css.topnavInner)}>
          {/* 브랜드 */}
          <Link aria-label="Work Archive 홈" className={cn(css.topnavBrand)} to="/">
            <div className={cn(css.topnavMark)} aria-hidden="true">WA</div>
            <span className={cn(css.topnavName)}>Work Archive</span>
          </Link>

          {/* 데스크탑 네비게이션 — sm(768px) 이상에서만 표시 */}
          <Group
            aria-label="주요 탐색"
            className={cn(css.topnavLinks)}
            component="nav"
            gap={2}
            visibleFrom="sm"
            wrap="nowrap"
          >
            {primaryNavigationItems.map((item) => (
              <AppNavLink end={item.to === '/'} key={item.to} to={item.to}>
                {item.label}
              </AppNavLink>
            ))}
          </Group>

          {/* 우측 액션 */}
          <div className={cn(css.topnavActions)}>
            <Box visibleFrom="sm">
              <SyncSafetyBadge />
            </Box>

            {/* 작품 추가 — 모바일: 아이콘, 데스크탑: 텍스트 포함 */}
            <Link
              aria-label="새 작품 추가"
              className={cn(css.addWorkLink)}
              to="/works/new"
            >
              <span aria-hidden="true">+</span>
              <Box component="span" visibleFrom="sm"> 작품 추가</Box>
            </Link>

            {/* 아바타 메뉴 */}
            <Menu position="bottom-end" shadow="xl" width={260}>
              <Menu.Target>
                <button
                  aria-label={accountMenuLabel}
                  className={cn(css.avatarButton)}
                  type="button"
                >
                  <Avatar
                    color={isAuthenticated ? 'archive' : 'gray'}
                    radius="xl"
                    size={32}
                    src={avatarImageUrl || null}
                  >
                    {avatarInitial}
                  </Avatar>
                </button>
              </Menu.Target>

              <Menu.Dropdown className={cn(css.accountMenuDropdown)}>
                <Box className={cn(css.menuHeader)}>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar
                      color={isAuthenticated ? 'archive' : 'gray'}
                      radius="xl"
                      size={36}
                      src={avatarImageUrl || null}
                    >
                      {avatarInitial}
                    </Avatar>
                    <Stack gap={1} miw={0}>
                      <Text fw={750} size="sm" truncate>
                        {accountLabel}
                      </Text>
                      {isAuthenticated && (
                        <Text c="dimmed" size="xs" truncate>
                          {avatarProfile.email}
                        </Text>
                      )}
                      <Group gap={5} align="center">
                        <Box
                          className={cn(
                            isAuthenticated
                              ? `${cn(css.statusDot)} ${cn(css.statusDotAuthenticated)}`
                              : cn(css.statusDot)
                          )}
                        />
                        <Text c="dimmed" size="xs">
                          {isAuthenticated ? '로그인됨' : '게스트 모드'}
                        </Text>
                      </Group>
                    </Stack>
                  </Group>
                </Box>

                <Menu.Item
                  className={cn(css.accountMenuItem)}
                  onClick={() => navigate('/account')}
                >
                  계정 개요
                </Menu.Item>
                <Menu.Item
                  className={cn(css.accountMenuItem)}
                  onClick={() => navigate('/account/settings')}
                >
                  설정과 백업
                </Menu.Item>

                <Menu.Divider />

                <Box px="xs" pb="xs">
                  <Box className={cn(css.themeToggleWrap)}>
                    <ThemeToggleControl fullWidth />
                  </Box>
                </Box>

                <Menu.Divider />

                {isAuthenticated ? (
                  <Menu.Item
                    className={cn(css.accountMenuItem)}
                    color="red"
                    onClick={() => void handleSignOut()}
                  >
                    로그아웃
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    className={cn(css.accountMenuItem)}
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

            {/* 모바일 버거 */}
            <Burger
              aria-label="메뉴 열기"
              hiddenFrom="md"
              onClick={mobileMenu.open}
              opened={mobileMenuOpened}
              size="sm"
            />
          </div>
        </div>
      </header>

      {/* ── 콘텐츠 영역 ── */}
      <main className={`app-content ${css.pageTransition}`}>
        {isLoading ? (
          <Box p="xl">
            <StateMessage
              description="개인 기록을 불러오는 동안 잠시만 기다려 주세요."
              eyebrow="Loading"
              title="Work Archive를 준비하고 있습니다"
              tone="loading"
            />
          </Box>
        ) : (
          <Outlet />
        )}
      </main>

      {/* ── 모바일 드로어 ── */}
      <Drawer
        hiddenFrom="md"
        onClose={mobileMenu.close}
        opened={mobileMenuOpened}
        padding="md"
        position="left"
        size="xs"
        title={
          <Group gap="sm" wrap="nowrap">
            <div className={cn(css.topnavMark)} aria-hidden="true">WA</div>
            <Text fw={800} size="sm" style={{ letterSpacing: '-0.02em' }}>
              Work Archive
            </Text>
          </Group>
        }
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
            + 작품 추가
          </AppLinkButton>

          <Box className={cn(css.mobileAccountCard)}>
            <Group gap="sm" wrap="nowrap">
              <Avatar
                color={isAuthenticated ? 'archive' : 'gray'}
                radius="xl"
                size={40}
                src={avatarImageUrl || null}
              >
                {avatarInitial}
              </Avatar>
              <Stack gap={2} miw={0}>
                <Text fw={750} size="sm" truncate>
                  {accountLabel}
                </Text>
                <Text c="dimmed" size="xs">
                  {isAuthenticated ? '로그인됨' : '게스트 모드'}
                </Text>
              </Stack>
            </Group>
          </Box>

          <Box className={cn(css.themeToggleWrap)}>
            <ThemeToggleControl fullWidth />
          </Box>

          <SyncSafetyBadge />

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
    </div>
  );
}
