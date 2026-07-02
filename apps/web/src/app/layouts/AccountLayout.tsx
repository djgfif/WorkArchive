import {
  Avatar,
  Box,
  Container,
  Divider,
  Grid,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  AppNavLink,
  BrandLink,
  LoadingState,
  ThemeToggleControl,
} from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { getUserAvatarProfile, useAuthSession } from '@features/auth';
import { cn, cx } from '@shared/utils/class-names';

import styles from './AccountLayout.module.css';

/* ── 아이콘 ── */
function IconHome({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconSettings({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconLogOut({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
function IconLogin({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}
function IconArchive({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect height="5" width="22" x="1" y="3" />
      <line x1="10" x2="14" y1="12" y2="12" />
    </svg>
  );
}

const accountNavigationItems = [
  {
    labelKey: 'navigation.accountOverview',
    to: '/account',
    icon: <IconHome />,
  },
  {
    labelKey: 'navigation.settingsBackup',
    to: '/account/settings',
    icon: <IconSettings />,
  },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const avatarProfile = getUserAvatarProfile(isAuthenticated ? user : null);
  const accountLabel = isAuthenticated
    ? avatarProfile.displayName
    : t('navigation.guest');
  const avatarInitial = isAuthenticated ? avatarProfile.initial : 'G';
  const avatarImageUrl = isAuthenticated ? avatarProfile.imageUrl : '';

  return (
    <main className="layout-shell layout-shell--account">
      <Container px="md" size={1360}>
        <Grid align="start" gap="xl">
          {/* 모바일 — 상단 수평 nav */}
          <Grid.Col hiddenFrom="lg" span={12}>
            <AccountSidebar
              accountLabel={accountLabel}
              avatarImageUrl={avatarImageUrl}
              avatarInitial={avatarInitial}
              isAuthenticated={isAuthenticated}
              loginReturnTo={loginReturnTo}
              onSignOut={() => void handleSignOut()}
              variant="mobile"
            />
          </Grid.Col>

          {/* 데스크탑 — 좌측 sticky 사이드바 */}
          <Grid.Col span={3} visibleFrom="lg">
            <Box pos="sticky" top={88}>
              <AccountSidebar
                accountLabel={accountLabel}
                avatarImageUrl={avatarImageUrl}
                avatarInitial={avatarInitial}
                isAuthenticated={isAuthenticated}
                loginReturnTo={loginReturnTo}
                onSignOut={() => void handleSignOut()}
                variant="desktop"
              />
            </Box>
          </Grid.Col>

          {/* 콘텐츠 영역 */}
          <Grid.Col span={{ base: 12, lg: 9 }}>
            {isLoading ? (
              <LoadingState rows={2} title={t('settings.loadingTitle')} />
            ) : (
              <Box className={cn(styles.contentTransition)}>
                <Outlet />
              </Box>
            )}
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}

/* ── 사이드바 컴포넌트 ── */
interface AccountSidebarProps {
  accountLabel: string;
  avatarImageUrl: string;
  avatarInitial: string;
  isAuthenticated: boolean;
  loginReturnTo: string;
  onSignOut: () => void;
  variant: 'desktop' | 'mobile';
}

function AccountSidebar({
  accountLabel,
  avatarImageUrl,
  avatarInitial,
  isAuthenticated,
  loginReturnTo,
  onSignOut,
  variant,
}: AccountSidebarProps) {
  const isMobile = variant === 'mobile';
  const { t } = useAppTranslation();

  return (
    <Stack gap="sm">
      <Box className={cn(styles.brandPanel)}>
        <BrandLink
          heading="Work Archive"
          kicker={t('navigation.accountBrandKicker')}
        />
      </Box>

      <Box className={cn(styles.sidebarCard)}>
        {/* 계정 헤더 */}
        <Box className={cn(styles.accountHeader)}>
          <Group gap="sm" wrap="nowrap">
            <Avatar
              className={cn(styles.avatar)}
              color={isAuthenticated ? 'archive' : 'gray'}
              radius="xl"
              size={44}
              src={avatarImageUrl || null}
              variant="filled"
            >
              {avatarInitial}
            </Avatar>
            <Stack className={cn(styles.accountDetails)} gap={3} miw={0}>
              <Text
                className={cn(styles.accountName)}
                fw={700}
                size="sm"
                truncate
              >
                {accountLabel}
              </Text>
              <Group gap={6} wrap="nowrap">
                <Box
                  className={cx(
                    styles.statusDot,
                    isAuthenticated && styles.statusDotAuthenticated,
                  )}
                />
                <Text c="dimmed" size="xs">
                  {isAuthenticated
                    ? t('navigation.signedIn')
                    : t('navigation.guestLocalStorage')}
                </Text>
              </Group>
            </Stack>
          </Group>
        </Box>

        {/* 네비게이션 */}
        <Box
          component="nav"
          aria-label={t('common.account')}
          className={cn(styles.navSection)}
        >
          <Stack gap={2}>
            {accountNavigationItems.map((item) => (
              <AccountNavItem
                end={item.to === '/account'}
                icon={item.icon}
                key={item.to}
                label={t(item.labelKey)}
                to={item.to}
              />
            ))}
          </Stack>
        </Box>

        <Divider color="var(--app-border-subtle)" mx="sm" />

        {/* 하단 액션 */}
        <Box className={cn(styles.footerSection)}>
          <Stack gap={2}>
            {/* 작품 목록으로 */}
            <AccountNavItem
              end={false}
              icon={<IconArchive />}
              label={t('navigation.worksList')}
              to="/works"
            />

            {/* 테마 전환 */}
            <Box className={cn(styles.themeWrap)}>
              <ThemeToggleControl fullWidth={isMobile} />
            </Box>

            {/* 로그인/로그아웃 */}
            {isAuthenticated ? (
              <Box
                component="button"
                className={cn(styles.signOutButton)}
                onClick={onSignOut}
              >
                <Box className={cn(styles.navIcon)}>
                  <IconLogOut />
                </Box>
                {t('navigation.logout')}
              </Box>
            ) : (
              <AccountNavItem
                end={false}
                icon={<IconLogin />}
                label={t('navigation.login')}
                state={{
                  returnTo: loginReturnTo,
                }}
                to="/auth/login"
              />
            )}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}

/* ── 사이드바 네비게이션 아이템 ── */
interface AccountNavItemProps {
  end: boolean;
  icon: ReactNode;
  label: string;
  state?: unknown;
  to: string;
}

function AccountNavItem({ end, icon, label, state, to }: AccountNavItemProps) {
  return (
    <AppNavLink end={end} fullWidth state={state} to={to}>
      <Group gap="sm" wrap="nowrap">
        <Box className={cn(styles.navIcon)}>
          {icon}
        </Box>
        {label}
      </Group>
    </AppNavLink>
  );
}
