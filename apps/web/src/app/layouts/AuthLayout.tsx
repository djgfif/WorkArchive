import { Box, Container, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link, Outlet } from 'react-router-dom';

import { ActionRow, SectionCard } from '../../shared/components/AppPrimitives';

export function AuthLayout() {
  return (
    <main className="layout-shell layout-shell--auth">
      <Box aria-hidden="true" className="layout-backdrop layout-backdrop--north" />
      <Box aria-hidden="true" className="layout-backdrop layout-backdrop--west" />

      <Container px={0} size={1260}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="xl" justify="center" mih="calc(100vh - 48px)">
            <Link className="brand-link" to="/">
              <span aria-hidden="true" className="brand-mark">
                WA
              </span>
              <div className="brand-copy">
                <span className="brand-kicker">취향 아카이브 서비스</span>
                <span className="brand-heading">워크 아카이브</span>
              </div>
            </Link>

            <Stack gap="md" maw="58ch">
              <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                계정
              </Text>
              <Title c="var(--text-primary)" order={1}>
                기록은 바로 시작하고, 계정은 필요할 때 연결합니다
              </Title>
              <Text c="var(--text-secondary)" maw="58ch">
                게스트로 가볍게 시작해도 되고, 로그인하면 기록을 이어서 보고 동기화까지
                연결할 수 있습니다.
              </Text>
            </Stack>

            <Stack gap="md">
              <SectionCard tone="subtle">
                <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                  로컬 우선
                </Text>
                <Title c="var(--text-primary)" order={2}>
                  지금 바로 기록 가능
                </Title>
                <Text c="var(--text-muted)">
                  계정이 없어도 이 기기에서 바로 내 아카이브를 시작할 수 있습니다.
                </Text>
              </SectionCard>

              <SectionCard tone="subtle">
                <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                  계정 확장
                </Text>
                <Title c="var(--text-primary)" order={2}>
                  로그인하면 이어서 관리
                </Title>
                <Text c="var(--text-muted)">
                  동기화와 계정 기반 관리 흐름은 인증 이후에 자연스럽게 이어집니다.
                </Text>
              </SectionCard>
            </Stack>

            <ActionRow>
              <Link className="secondary-link" to="/">
                홈으로 돌아가기
              </Link>
              <Link className="secondary-link" to="/works">
                작품 둘러보기
              </Link>
            </ActionRow>
          </Stack>

          <Box mih="calc(100vh - 48px)" style={{ display: 'grid', alignContent: 'center' }}>
            <Outlet />
          </Box>
        </SimpleGrid>
      </Container>
    </main>
  );
}
