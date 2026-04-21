import { Box, Container, Grid, Stack, Text, Title } from '@mantine/core';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import {
  ActionRow,
  SectionCard,
  StateMessage,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

const accountNavigationItems = [
  { label: '계정 홈', to: '/account' },
  { label: '동기화', to: '/account/sync' },
  { label: '설정', to: '/account/settings' },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--account">
      <Box aria-hidden="true" className="layout-backdrop layout-backdrop--east" />
      <Container px={0} size={1360}>
        <Grid align="start" gutter="xl">
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <Box style={{ position: 'sticky', top: 24 }}>
              <SectionCard tone="subtle">
              <Link className="brand-link" to="/">
                <span aria-hidden="true" className="brand-mark">
                  WA
                </span>
                <div className="brand-copy">
                  <span className="brand-kicker">계정 센터</span>
                  <span className="brand-heading">관리 맥락</span>
                </div>
              </Link>

                <Stack gap="md">
                  <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                  {isAuthenticated ? '로그인됨' : '게스트 모드'}
                  </Text>
                  <Title c="var(--text-primary)" order={2}>
                  {isAuthenticated ? '계정과 동기화 설정' : '계정 기능 안내'}
                  </Title>
                  <Text c="var(--text-muted)">
                  {isAuthenticated
                    ? `${user?.email ?? '계정'}으로 사용하는 관리 화면입니다.`
                    : '로그인하면 동기화와 계정 설정을 이 영역에서 관리할 수 있습니다.'}
                  </Text>
                </Stack>

                <nav aria-label="계정 메뉴" className="account-nav">
                  {accountNavigationItems.map((item) => (
                    <NavLink
                      className={({ isActive }) =>
                        isActive ? 'account-nav-link active' : 'account-nav-link'
                      }
                      end={item.to === '/account'}
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <ActionRow>
                  <Link className="secondary-link" to="/profile">
                    프로필로 돌아가기
                  </Link>
                  {isAuthenticated ? (
                    <button onClick={() => void handleSignOut()} type="button">
                      로그아웃
                    </button>
                  ) : (
                    <Link className="secondary-link" to="/auth/login">
                      로그인
                    </Link>
                  )}
                </ActionRow>
              </SectionCard>
            </Box>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 9 }}>
            {isLoading ? (
              <StateMessage
                description="잠시만 기다려주세요."
                eyebrow="불러오는 중"
                title="계정 설정을 준비하고 있습니다"
                tone="loading"
              />
            ) : (
              <Outlet />
            )}
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}
