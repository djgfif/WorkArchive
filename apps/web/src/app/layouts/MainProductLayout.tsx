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
  ThemeIcon,
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

/* ── 네비게이션 항목 (설정은 프로필 메뉴에만) ── */
const primaryNavigationItems = [
  { label: '홈',   to: '/' },
  { label: '작품', to: '/works' },
] as const;

/* ── 아이콘 SVG 인라인 ── */
function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24" width={size}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconUser({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconSettings({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconLogOut({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
function IconLogin({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}
function IconUserPlus({ size = 16 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" x2="20" y1="8" y2="14" />
      <line x1="23" x2="17" y1="11" y2="11" />
    </svg>
  );
}

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
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   '50%',
          padding:        2,
          outline:        'none',
          transition:     'box-shadow var(--wa-motion-fast, 150ms)',
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
            fontWeight:    800,
            fontSize:      '0.85rem',
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

            {/* ── Center: Primary nav (desktop only, 홈·작품만) ────────── */}
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

            {/* ── Right: 작품추가(데스크탑) + Profile ─────────────────── */}
            <Box className="header-right">
              {/* 작품 추가 버튼 — 데스크탑에서만 표시, 모바일은 Drawer에서 */}
              <Box visibleFrom="md">
                <Tooltip label="새 작품 기록 추가 (N)" position="bottom" withArrow>
                  <AppLinkButton
                    leftSection={<IconPlus size={14} />}
                    size="sm"
                    to="/works/new"
                    tone="primary"
                  >
                    작품 추가
                  </AppLinkButton>
                </Tooltip>
              </Box>

              {/* Profile avatar menu (desktop) */}
              <Box visibleFrom="md">
                <Menu
                  position="bottom-end"
                  shadow="xl"
                  transitionProps={{ transition: 'pop-top-right', duration: 180 }}
                  width={290}
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
                        borderBottom:  '1px solid var(--app-border-subtle)',
                        marginBottom:  '0.35rem',
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
                                width:        7,
                                height:       7,
                                borderRadius: '50%',
                                flexShrink:   0,
                                background:   isAuthenticated
                                  ? 'var(--app-accent-teal, #2dd4bf)'
                                  : 'var(--app-text-muted)',
                              }}
                            />
                            <Text c="dimmed" size="xs" truncate>
                              {isAuthenticated ? '로그인됨' : '게스트 — 이 기기에만 저장됩니다'}
                            </Text>
                          </Group>
                        </Stack>
                      </Group>
                    </Box>

                    {/* 계정 메뉴 항목 */}
                    <Menu.Item
                      leftSection={
                        <ThemeIcon color="gray" size={22} variant="light" radius="sm">
                          <IconUser size={13} />
                        </ThemeIcon>
                      }
                      onClick={() => navigate('/account')}
                    >
                      계정 개요
                    </Menu.Item>
                    <Menu.Item
                      leftSection={
                        <ThemeIcon color="gray" size={22} variant="light" radius="sm">
                          <IconSettings size={13} />
                        </ThemeIcon>
                      }
                      onClick={() => navigate('/account/settings')}
                    >
                      설정과 백업
                    </Menu.Item>

                    {/* 테마 전환 */}
                    <Box px="xs" py={6}>
                      <ThemeToggleControl fullWidth />
                    </Box>

                    <Menu.Divider />

                    {/* 로그인/로그아웃 */}
                    {isAuthenticated ? (
                      <Menu.Item
                        color="red"
                        leftSection={
                          <ThemeIcon color="red" size={22} variant="light" radius="sm">
                            <IconLogOut size={13} />
                          </ThemeIcon>
                        }
                        onClick={() => void handleSignOut()}
                      >
                        로그아웃
                      </Menu.Item>
                    ) : (
                      <>
                        <Menu.Item
                          fw={600}
                          leftSection={
                            <ThemeIcon color="archive" size={22} variant="light" radius="sm">
                              <IconLogin size={13} />
                            </ThemeIcon>
                          }
                          onClick={() => navigate('/auth/login')}
                        >
                          로그인
                        </Menu.Item>
                        <Menu.Item
                          leftSection={
                            <ThemeIcon color="gray" size={22} variant="light" radius="sm">
                              <IconUserPlus size={13} />
                            </ThemeIcon>
                          }
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
          Mobile drawer — 작품추가 + 계정 + 테마 통합
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

          {/* 작품 추가 CTA — 모바일 Drawer 내 단일 위치 */}
          <AppLinkButton
            fullWidth
            leftSection={<IconPlus size={14} />}
            onClick={mobileMenu.close}
            to="/works/new"
            tone="primary"
          >
            작품 추가
          </AppLinkButton>

          {/* 계정 상태 카드 */}
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
              <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
                {isAuthenticated ? '로그인' : '게스트'}
              </AppBadge>
            </Stack>
          </Group>

          {/* 테마 전환 */}
          <ThemeToggleControl fullWidth />

          {/* 계정 액션 */}
          {isAuthenticated ? (
            <Stack gap="xs">
              <AppLinkButton fullWidth onClick={mobileMenu.close} to="/account" tone="secondary">
                계정 개요
              </AppLinkButton>
              <AppLinkButton fullWidth onClick={mobileMenu.close} to="/account/settings" tone="secondary">
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
            </Stack>
          ) : (
            <Stack gap="xs">
              <AppLinkButton fullWidth onClick={mobileMenu.close} to="/auth/login" tone="primary">
                로그인
              </AppLinkButton>
              <AppLinkButton fullWidth onClick={mobileMenu.close} to="/auth/register" tone="secondary">
                회원가입
              </AppLinkButton>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </main>
  );
}
