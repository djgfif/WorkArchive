import { Badge, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
  BrandLink,
  SectionCard,
  StateMessage,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

const mainNavigationItems: Array<{
  label: string;
  statusLabel?: string;
  to: string;
}> = [
  { label: '홈', to: '/' },
  { label: '작품', to: '/works' },
  { label: '티어 보드', to: '/tier-boards', statusLabel: '준비 중' },
  { label: '인사이트', to: '/insights', statusLabel: '준비 중' },
  { label: '커뮤니티', to: '/community', statusLabel: '준비 중' },
  { label: '프로필', to: '/profile' },
];

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
          <SectionCard tone="hero">
            <Stack gap="xl">
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <BrandLink heading="워크 아카이브" kicker="개인 취향 아카이브" />

                <ActionRow justify="flex-end">
                  <ThemeToggleControl />
                  {!isAuthenticated && (
                    <>
                      <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                      <AppLinkButton to="/auth/register">회원가입</AppLinkButton>
                    </>
                  )}
                  {isAuthenticated && (
                    <AppButton onClick={() => void handleSignOut()} type="button">
                      로그아웃
                    </AppButton>
                  )}
                  <AppLinkButton to="/works/new" tone="primary">
                    작품 추가
                  </AppLinkButton>
                </ActionRow>
              </Group>

              <Group align="flex-start" justify="space-between" wrap="wrap">
                <nav aria-label="주요 메뉴" className="app-nav app-nav--primary">
                  {mainNavigationItems.map((item) => (
                    <NavLink
                      className={({ isActive }) =>
                        isActive ? 'app-nav-link active' : 'app-nav-link'
                      }
                      end={item.to === '/'}
                      key={item.to}
                      to={item.to}
                    >
                      <span>{item.label}</span>
                      {item.statusLabel && <Badge size="sm">{item.statusLabel}</Badge>}
                    </NavLink>
                  ))}
                </nav>

                <SectionCard className="session-card session-card--compact" tone="subtle">
                  <Text c="var(--app-accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                    {isAuthenticated ? '로그인됨' : '게스트 모드'}
                  </Text>
                  <Stack gap={4}>
                    <Title order={3}>
                      {isAuthenticated ? '계정 아카이브 사용 중' : '로컬 아카이브 사용 중'}
                    </Title>
                    <Text c="var(--app-text-muted)">
                      {isAuthenticated
                        ? user?.email
                        : '로그인하지 않아도 이 기기에 기록을 저장할 수 있습니다.'}
                    </Text>
                  </Stack>
                  <ActionRow>
                    <AppLinkButton to="/profile">프로필</AppLinkButton>
                    <AppLinkButton to="/account">계정 센터</AppLinkButton>
                  </ActionRow>
                </SectionCard>
              </Group>
            </Stack>
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
