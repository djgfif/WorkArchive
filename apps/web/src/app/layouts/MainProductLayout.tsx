import { Button, Container, Menu, Stack } from '@mantine/core';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  AppLinkButton,
  AppNavLink,
  BrandLink,
  SectionCard,
  StateMessage,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

const mainNavigationItems = [
  { label: '홈', to: '/' },
  { label: '작품', to: '/works' },
  { label: '프로필', to: '/profile' },
] as const;

export function MainProductLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <Container px="md" size={1360}>
        <Stack gap="xl">
          <SectionCard gap="lg" tone="hero">
            <div
              style={{
                alignItems: 'center',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  flex: '1 1 28rem',
                  flexWrap: 'wrap',
                  gap: '0.875rem',
                  minWidth: 0,
                }}
              >
                <BrandLink heading="워크 아카이브" kicker="개인 취향 아카이브" />
                <nav
                  aria-label="주요 메뉴"
                  style={{
                    alignItems: 'center',
                    display: 'flex',
                    flex: '1 1 18rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    minWidth: 0,
                  }}
                >
                  {mainNavigationItems.map((item) => (
                    <AppNavLink end={item.to === '/'} key={item.to} to={item.to}>
                      {item.label}
                    </AppNavLink>
                  ))}
                </nav>
              </div>

              <div
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                }}
              >
                <ThemeToggleControl />
                <AppLinkButton to="/works/new" tone="primary">
                  작품 추가
                </AppLinkButton>

                {isAuthenticated ? (
                  <Menu position="bottom-end" shadow="md" width={220} withinPortal={false}>
                    <Menu.Target>
                      <Button variant="default">
                        {user?.email ?? '내 계정'}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => navigate('/profile')}>프로필</Menu.Item>
                      <Menu.Item onClick={() => navigate('/account')}>계정 센터</Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" onClick={() => void handleSignOut()}>
                        로그아웃
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                ) : (
                  <>
                    <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                    <AppLinkButton to="/auth/register" tone="quiet">
                      회원가입
                    </AppLinkButton>
                  </>
                )}
              </div>
            </div>
          </SectionCard>

          {isLoading ? (
            <StateMessage
              description="잠시만 기다려주세요."
              eyebrow="불러오는 중"
              title="워크 아카이브를 불러오고 있습니다"
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
