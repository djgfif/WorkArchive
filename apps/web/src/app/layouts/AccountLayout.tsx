import { Container, Grid, Stack } from '@mantine/core';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
  BrandLink,
  SectionCard,
  SectionIntro,
  StateMessage,
  ThemeToggleControl,
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
      <Container px="md" size={1360}>
        <Grid align="start" gutter="xl">
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <div style={{ position: 'sticky', top: 24 }}>
              <SectionCard tone="subtle">
                <BrandLink heading="관리 맥락" kicker="계정 센터" />

                <SectionIntro
                  description={
                    isAuthenticated
                      ? `${user?.email ?? '계정'}으로 사용하는 관리 화면입니다.`
                      : '로그인하면 동기화와 계정 설정을 이 영역에서 관리할 수 있습니다.'
                  }
                  eyebrow={isAuthenticated ? '로그인됨' : '게스트 모드'}
                  title={isAuthenticated ? '계정과 동기화 설정' : '계정 기능 안내'}
                />

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
                  <ThemeToggleControl />
                  <AppLinkButton to="/profile">프로필로 돌아가기</AppLinkButton>
                  {isAuthenticated ? (
                    <AppButton onClick={() => void handleSignOut()} type="button">
                      로그아웃
                    </AppButton>
                  ) : (
                    <AppLinkButton to="/auth/login">
                      로그인
                    </AppLinkButton>
                  )}
                </ActionRow>
              </SectionCard>
            </div>
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
