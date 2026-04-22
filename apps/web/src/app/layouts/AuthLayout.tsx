import { Container, SimpleGrid, Stack } from '@mantine/core';
import { Outlet } from 'react-router-dom';

import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  BrandLink,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '../../shared/components/AppPrimitives';

export function AuthLayout() {
  return (
    <main className="layout-shell layout-shell--auth">
      <Container px="md" size={1260}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="xl" justify="center" mih="calc(100vh - 48px)">
            <BrandLink heading="워크 아카이브" kicker="취향 아카이브 서비스" />

            <SectionIntro
              description="먼저 기록을 시작하고, 계정은 필요할 때 연결하는 구조를 유지합니다."
              eyebrow="계정"
              title="입력은 가볍게, 기록은 바로 이어집니다"
              titleOrder={1}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <SectionCard gap="sm" padding="lg" tone="subtle">
                <AppBadge tone="accent">로컬 우선</AppBadge>
                <SectionIntro
                  description="로그인 전에도 이 기기에서 바로 아카이브를 시작할 수 있습니다."
                  title="지금 바로 기록"
                  titleOrder={3}
                />
              </SectionCard>

              <SectionCard gap="sm" padding="lg" tone="subtle">
                <AppBadge tone="accent">계정 확장</AppBadge>
                <SectionIntro
                  description="로그인 후에는 동기화와 설정을 계정 센터에서 차분하게 관리합니다."
                  title="나중에 자연스럽게 연결"
                  titleOrder={3}
                />
              </SectionCard>
            </SimpleGrid>

            <ActionRow>
              <ThemeToggleControl />
              <AppLinkButton to="/">홈으로 돌아가기</AppLinkButton>
              <AppLinkButton to="/works" tone="quiet">
                작품 보기
              </AppLinkButton>
            </ActionRow>
          </Stack>

          <div style={{ alignContent: 'center', display: 'grid', minHeight: 'calc(100vh - 48px)' }}>
            <Outlet />
          </div>
        </SimpleGrid>
      </Container>
    </main>
  );
}
