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
import {
  ArchiveScopeIndicator,
  getUserAvatarProfile,
  useAuthSession,
} from '@features/auth';
import { SyncSafetyBadge } from '@features/sync';
import {
  CommandPalette,
  COMMAND_PALETTE_EVENT,
} from '@shared/components/CommandPalette';
import { useWorkLinkKeyboardNav } from '@shared/components/useWorkLinkKeyboardNav';
import { getPrimaryNavigationItems } from './navigation';
import styles from './MainProductLayout.module.css';
import { cn } from '@shared/utils/class-names';
import { useAppTranslation } from '@app/i18n';

const css = styles;

export function MainProductLayout() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpened, mobileMenu] = useDisclosure(false);
  useWorkLinkKeyboardNav();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;
  const avatarProfile = getUserAvatarProfile(isAuthenticated ? user : null);
  const accountLabel = isAuthenticated
    ? avatarProfile.displayName
    : t('navigation.guest');
  const avatarInitial = isAuthenticated ? avatarProfile.initial : 'G';
  const avatarImageUrl = isAuthenticated ? avatarProfile.imageUrl : '';
  const accountMenuLabel = isAuthenticated
    ? `${t('navigation.accountMenu')}: ${accountLabel}, ${avatarProfile.email}`
    : `${t('navigation.accountMenu')}: ${accountLabel}`;
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
          <Link
            aria-label={t('navigation.workArchiveHome')}
            className={cn(css.topnavBrand)}
            to="/"
          >
            <div className={cn(css.topnavMark)} aria-hidden="true">
              WA
            </div>
            <span className={cn(css.topnavName)}>Work Archive</span>
          </Link>

          {/* 데스크탑 네비게이션 — sm(768px) 이상에서만 표시 */}
          <Group
            aria-label={t('navigation.primaryNavigation')}
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
            <Box
              aria-label={t('navigation.commandPalette')}
              className={cn(css.commandButton)}
              component="button"
              onClick={() =>
                window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT))
              }
              type="button"
              visibleFrom="sm"
            >
              <span aria-hidden="true">⌘K</span>
            </Box>
            <Box visibleFrom="sm">
              <SyncSafetyBadge />
            </Box>

            {/* 작품 추가 — 모바일: 아이콘, 데스크탑: 텍스트 포함 */}
            <Link
              aria-label={t('navigation.addNewWork')}
              className={cn(css.addWorkLink)}
              to="/works/new"
            >
              <span aria-hidden="true">+</span>
              <Box component="span" visibleFrom="sm">
                {' '}
                {t('navigation.addWork')}
              </Box>
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
                              : cn(css.statusDot),
                          )}
                        />
                        <Text c="dimmed" size="xs">
                          {isAuthenticated
                            ? t('navigation.signedIn')
                            : t('navigation.guestMode')}
                        </Text>
                      </Group>
                    </Stack>
                  </Group>
                </Box>

                <Menu.Item
                  className={cn(css.accountMenuItem)}
                  onClick={() => navigate('/account')}
                >
                  {t('navigation.accountOverview')}
                </Menu.Item>
                <Menu.Item
                  className={cn(css.accountMenuItem)}
                  onClick={() => navigate('/account/settings')}
                >
                  {t('navigation.settingsBackup')}
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
                    {t('navigation.logout')}
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
                    {t('navigation.login')}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>

            {/* 모바일 버거 */}
            <Burger
              aria-label={t('navigation.openMenu')}
              className={cn(css.mobileMenuButton)}
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
        <ArchiveScopeIndicator />
        {isLoading ? (
          <Box p="xl">
            <StateMessage
              description={t('navigation.syncPreparingDescription')}
              eyebrow="Loading"
              title={t('navigation.syncPreparingTitle')}
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
            <div className={cn(css.topnavMark)} aria-hidden="true">
              WA
            </div>
            <Text className={cn(css.drawerBrandText)} fw={800} size="sm">
              Work Archive
            </Text>
          </Group>
        }
      >
        <Stack gap="lg" h="100%">
          <Stack
            aria-label={t('navigation.mobileNavigation')}
            component="nav"
            gap={4}
          >
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
            + {t('navigation.addWork')}
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
                  {isAuthenticated
                    ? t('navigation.signedIn')
                    : t('navigation.guestMode')}
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
                {t('navigation.accountOverview')}
              </AppLinkButton>
              <AppLinkButton
                fullWidth
                onClick={mobileMenu.close}
                to="/account/settings"
                tone="secondary"
              >
                {t('navigation.settingsBackup')}
              </AppLinkButton>
              <AppButton
                fullWidth
                onClick={() => void handleSignOut()}
                tone="quiet"
                type="button"
              >
                {t('navigation.logout')}
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
              {t('navigation.login')}
            </AppLinkButton>
          )}
        </Stack>
      </Drawer>

      <CommandPalette />
    </div>
  );
}
