import { Container, SimpleGrid, Stack } from '@mantine/core';
import { Outlet } from 'react-router-dom';

import {
  ActionRow,
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
              description="게스트로 가볍게 시작해도 되고, 로그인하면 기록을 이어서 보고 동기화까지 연결할 수 있습니다."
              eyebrow="계정"
              title="기록은 바로 시작하고, 계정은 필요할 때 연결합니다"
              titleOrder={1}
            />

            <Stack gap="md">
              <SectionCard tone="subtle">
                <SectionIntro
                  description="계정이 없어도 이 기기에서 바로 내 아카이브를 시작할 수 있습니다."
                  eyebrow="로컬 우선"
                  title="지금 바로 기록 가능"
                />
              </SectionCard>

              <SectionCard tone="subtle">
                <SectionIntro
                  description="동기화와 계정 기반 관리 흐름은 인증 이후에 자연스럽게 이어집니다."
                  eyebrow="계정 확장"
                  title="로그인하면 이어서 관리"
                />
              </SectionCard>
            </Stack>

            <ActionRow>
              <ThemeToggleControl />
              <AppLinkButton to="/">홈으로 돌아가기</AppLinkButton>
              <AppLinkButton to="/works">작품 둘러보기</AppLinkButton>
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
