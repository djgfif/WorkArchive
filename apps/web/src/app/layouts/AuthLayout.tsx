import { Container, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';

type AuthLayoutProps = {
  children?: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
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
              <Text c="var(--app-text-strong)" fw={700}>
                워크 아카이브
              </Text>
            </Group>
          </Link>

          {children ?? <Outlet />}
        </Stack>
      </Container>
    </main>
  );
}
