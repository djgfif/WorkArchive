import { Button, Container, Flex, Group, Menu, Stack, Text } from '@mantine/core';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  AppLinkButton,
  AppNavLink,
  BrandLink,
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
        <Stack gap="lg">
          <header
            style={{
              borderBottom: '1px solid var(--app-border-color)',
              paddingBottom: '1rem',
            }}
          >
            <Flex
              style={{
                gap: '1rem',
              }}
              align={{ base: 'stretch', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
            >
              <Group
                gap="lg"
                miw={0}
                wrap="wrap"
              >
                <BrandLink heading="워크 아카이브" kicker="개인 취향 아카이브" />
                <nav
                  aria-label="주요 메뉴"
                  style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: '1.25rem',
                    flexWrap: 'wrap',
                    minWidth: 0,
                  }}
                >
                  {mainNavigationItems.map((item) => (
                    <AppNavLink end={item.to === '/'} key={item.to} to={item.to}>
                      {item.label}
                    </AppNavLink>
                  ))}
                </nav>
              </Group>

              <Group gap="sm" justify="flex-end" wrap="wrap">
                <ThemeToggleControl />
                <AppLinkButton to="/works/new" tone="primary">
                  작품 추가
                </AppLinkButton>

                {isAuthenticated ? (
                  <>
                    {user?.email && (
                      <Text c="var(--app-text-muted)" size="sm">
                        {user.email}
                      </Text>
                    )}
                    <Menu position="bottom-end" shadow="md" width={220} withinPortal={false}>
                      <Menu.Target>
                        <Button aria-label={user?.email ?? '계정'} variant="subtle">
                          계정
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {user?.email && <Menu.Label>{user.email}</Menu.Label>}
                        <Menu.Item onClick={() => navigate('/profile')}>프로필</Menu.Item>
                        <Menu.Item onClick={() => navigate('/account')}>계정 센터</Menu.Item>
                        <Menu.Divider />
                        <Menu.Item color="red" onClick={() => void handleSignOut()}>
                          로그아웃
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </>
                ) : (
                  <>
                    <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                    <AppLinkButton to="/auth/register" tone="quiet">
                      회원가입
                    </AppLinkButton>
                  </>
                )}
              </Group>
            </Flex>
          </header>

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
