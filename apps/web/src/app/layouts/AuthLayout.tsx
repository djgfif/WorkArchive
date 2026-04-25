import { Container, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import {
  ActionRow,
  AppLinkButton,
  BrandLink,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';

type AuthLayoutProps = {
  children?: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="layout-shell layout-shell--auth">
      <Container px="md" size={860}>
        <Stack gap="xl" justify="center" mih="calc(100vh - 48px)">
          <Stack align="center" gap="md">
            <BrandLink heading="워크 아카이브" kicker="취향 아카이브 서비스" />
            <ActionRow justify="center">
              <ThemeToggleControl />
              <AppLinkButton to="/">홈으로 돌아가기</AppLinkButton>
              <AppLinkButton to="/works" tone="quiet">
                작품 보기
              </AppLinkButton>
            </ActionRow>
          </Stack>

          {children ?? <Outlet />}
        </Stack>
      </Container>
    </main>
  );
}
