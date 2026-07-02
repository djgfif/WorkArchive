import { Container, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { useAppTranslation } from '@app/i18n';
import { AppBadge } from '@shared/components/AppPrimitives';
import { cn } from '@shared/utils/class-names';

import styles from './AuthLayout.module.css';

type AuthLayoutProps = {
  children?: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useAppTranslation();
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
          <Link className={cn(styles.brandLink)} to="/">
            <Group gap="sm" justify="center" wrap="nowrap">
              <ThemeIcon color="archive" radius="md" size={34} variant="light">
                <Text fw={700} size="xs">
                  WA
                </Text>
              </ThemeIcon>
              <Text c="var(--mantine-color-text)" fw={700}>
                {t('auth.layout.brand')}
              </Text>
            </Group>
          </Link>

          {content}

          <Stack align="center" gap="xs">
            <Group gap="xs" justify="center" wrap="wrap">
              <AppBadge tone="accent">
                {t('auth.layout.badgeLocalFirst')}
              </AppBadge>
              <AppBadge tone="muted">
                {t('auth.layout.badgeOptionalSync')}
              </AppBadge>
              <AppBadge tone="muted">
                {t('auth.layout.badgeNoPublicFeed')}
              </AppBadge>
            </Group>
            <Text c="var(--mantine-color-dimmed)" maw={420} size="sm" ta="center">
              {t('auth.layout.description')}
            </Text>
          </Stack>
        </Stack>
      </Container>
    </main>
  );
}
