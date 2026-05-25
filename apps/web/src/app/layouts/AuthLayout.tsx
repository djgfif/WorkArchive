import { Container, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { AppBadge } from '@shared/components/AppPrimitives';

type AuthLayoutProps = {
  children?: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const content = children ?? <Outlet />;

  if (location.pathname === '/auth/login') {
    return (
      <main className="layout-shell layout-shell--auth">
        {content}
      </main>
    );
  }

  return (
    <main className="layout-shell layout-shell--auth">
      <Container px="md" size={500}>
        <Stack align="center" gap="lg" justify="center" mih="calc(100vh - 48px)">
          <Link style={{ textDecoration: 'none' }} to="/">
            <Group gap="sm" justify="center" wrap="nowrap">
              <ThemeIcon color="archive" radius="md" size={34} variant="light">
                <Text fw={700} size="xs">
                  WA
                </Text>
              </ThemeIcon>
              <Text c="var(--mantine-color-text)" fw={700}>
                워크 아카이브
              </Text>
            </Group>
          </Link>

          {content}

          <Stack align="center" gap="xs">
            <Group gap="xs" justify="center" wrap="wrap">
              <AppBadge tone="accent">로컬 우선 저장</AppBadge>
              <AppBadge tone="muted">선택적 계정 동기화</AppBadge>
              <AppBadge tone="muted">공개 피드 없음</AppBadge>
            </Group>
            <Text c="var(--mantine-color-dimmed)" maw={420} size="sm" ta="center">
              로그인 전에도 기록은 이 기기에 저장됩니다. 계정은 백업과 제한적
              동기화를 위한 선택 경로입니다.
            </Text>
          </Stack>
        </Stack>
      </Container>
    </main>
  );
}
