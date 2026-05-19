import { Avatar, Box, Container, Divider, Grid, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  AppNavLink,
  LoadingState,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

/* ── 아이콘 ── */
function IconHome({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconSettings({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconLogOut({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
function IconLogin({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}
function IconArchive({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect height="5" width="22" x="1" y="3" />
      <line x1="10" x2="14" y1="12" y2="12" />
    </svg>
  );
}

const accountNavigationItems = [
  { label: '계정 개요', to: '/account',          icon: <IconHome /> },
  { label: '설정과 백업', to: '/account/settings', icon: <IconSettings /> },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const accountLabel   = isAuthenticated ? (user?.email ?? '계정') : '게스트';
  const avatarInitial  = isAuthenticated
    ? (accountLabel.split('@')[0]?.[0] ?? 'U').toUpperCase()
    : 'G';

  return (
    <main className="layout-shell layout-shell--account">
      <Container px="md" size={1360}>
        <Grid align="start" gutter="xl">
          {/* 모바일 — 상단 수평 nav */}
          <Grid.Col hiddenFrom="lg" span={12}>
            <AccountSidebar
              accountLabel={accountLabel}
              avatarInitial={avatarInitial}
              isAuthenticated={isAuthenticated}
              onSignOut={() => void handleSignOut()}
              variant="mobile"
            />
          </Grid.Col>

          {/* 데스크탑 — 좌측 sticky 사이드바 */}
          <Grid.Col span={3} visibleFrom="lg">
            <Box pos="sticky" top={88}>
              <AccountSidebar
                accountLabel={accountLabel}
                avatarInitial={avatarInitial}
                isAuthenticated={isAuthenticated}
                onSignOut={() => void handleSignOut()}
                variant="desktop"
              />
            </Box>
          </Grid.Col>

          {/* 콘텐츠 영역 */}
          <Grid.Col span={{ base: 12, lg: 9 }}>
            {isLoading ? (
              <LoadingState rows={2} title="계정 설정을 준비하고 있습니다" />
            ) : (
              <Box
                style={{
                  animation: 'pageEnter 280ms cubic-bezier(0.16,1,0.3,1) both',
                }}
              >
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
  accountLabel:    string;
  avatarInitial:   string;
  isAuthenticated: boolean;
  onSignOut:       () => void;
  variant:         'desktop' | 'mobile';
}

function AccountSidebar({
  accountLabel,
  avatarInitial,
  isAuthenticated,
  onSignOut,
  variant,
}: AccountSidebarProps) {
  const isMobile = variant === 'mobile';

  return (
    <Box
      style={{
        background:   'var(--app-surface-card)',
        border:       '1px solid var(--app-border-default)',
        borderRadius: 'var(--mantine-radius-xl)',
        overflow:     'hidden',
      }}
    >
      {/* 계정 헤더 */}
      <Box
        style={{
          padding:       '1.25rem 1.25rem 1rem',
          borderBottom:  '1px solid var(--app-border-subtle)',
          background:    'var(--app-surface-subtle)',
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <Avatar
            color={isAuthenticated ? 'archive' : 'gray'}
            radius="xl"
            size={44}
            variant="filled"
            style={{ fontWeight: 800, flexShrink: 0 }}
          >
            {avatarInitial}
          </Avatar>
          <Stack gap={3} miw={0} style={{ flex: 1 }}>
            <Text
              fw={700}
              size="sm"
              truncate
              style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.01em' }}
            >
              {accountLabel}
            </Text>
            <Group gap={6} wrap="nowrap">
              <Box
                style={{
                  width:        7,
                  height:       7,
                  borderRadius: '50%',
                  flexShrink:   0,
                  background:   isAuthenticated
                    ? 'var(--app-accent-teal, #2dd4bf)'
                    : 'var(--app-text-muted)',
                }}
              />
              <Text c="dimmed" size="xs">
                {isAuthenticated ? '로그인됨' : '게스트 — 로컬 저장'}
              </Text>
            </Group>
          </Stack>
        </Group>
      </Box>

      {/* 네비게이션 */}
      <Box
        component="nav"
        aria-label="계정 내비게이션"
        style={{ padding: '0.5rem' }}
      >
        <Stack gap={2}>
          {accountNavigationItems.map((item) => (
            <AccountNavItem
              end={item.to === '/account'}
              icon={item.icon}
              key={item.to}
              label={item.label}
              to={item.to}
            />
          ))}
        </Stack>
      </Box>

      <Divider color="var(--app-border-subtle)" mx="sm" />

      {/* 하단 액션 */}
      <Box style={{ padding: '0.5rem' }}>
        <Stack gap={2}>
          {/* 작품 목록으로 */}
          <AccountNavItem
            end={false}
            icon={<IconArchive />}
            label="작품 목록으로"
            to="/works"
          />

          {/* 테마 전환 */}
          <Box style={{ padding: '0.25rem 0.5rem' }}>
            <ThemeToggleControl fullWidth={isMobile} />
          </Box>

          {/* 로그인/로그아웃 */}
          {isAuthenticated ? (
            <Box
              component="button"
              onClick={onSignOut}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '0.625rem',
                padding:        '0.5rem 0.75rem',
                borderRadius:   'var(--mantine-radius-md)',
                border:         'none',
                background:     'transparent',
                cursor:         'pointer',
                color:          'var(--mantine-color-red-5)',
                fontWeight:     500,
                fontSize:       '0.875rem',
                width:          '100%',
                textAlign:      'left',
                transition:     'background var(--wa-motion-fast, 150ms)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  'color-mix(in srgb, var(--mantine-color-red-5) 10%, transparent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Box style={{ opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                <IconLogOut />
              </Box>
              로그아웃
            </Box>
          ) : (
            <AccountNavItem
              end={false}
              icon={<IconLogin />}
              label="로그인"
              to="/auth/login"
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}

/* ── 사이드바 네비게이션 아이템 ── */
interface AccountNavItemProps {
  end:   boolean;
  icon:  ReactNode;
  label: string;
  to:    string;
}

function AccountNavItem({ end, icon, label, to }: AccountNavItemProps) {
  return (
    <AppNavLink end={end} fullWidth to={to}>
      <Group gap="sm" wrap="nowrap">
        <Box style={{ opacity: 0.7, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        {label}
      </Group>
    </AppNavLink>
  );
}
