import { Group, SimpleGrid, Text } from '@mantine/core';

import {
  AppBadge,
  AppLinkButton,
  KeyValueGrid,
  MetricPill,
  SectionCard,
  SectionIntro,
} from '../../../shared/components/AppPrimitives';
import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useSyncDashboard } from '../../sync/hooks/useSyncDashboard';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import { formatWorkDateTime } from '../../works/utils/work-options';

function formatOptionalDate(value: string | null, fallback = '아직 없음') {
  return value ? formatWorkDateTime(value) : fallback;
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function AccountOverviewPage() {
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const syncAttentionCount = queueItems.length + conflictWorks.length;

  return (
    <AccountPageTemplate
      actions={<AppLinkButton to="/profile">기록 요약 보기</AppLinkButton>}
      description={
        isAuthenticated
          ? '동기화, 계정 상태, 설정 진입을 한 곳에 모아 관리하는 계정 전용 영역입니다.'
          : '지금은 게스트 모드입니다. 로그인하면 계정 기반 동기화와 설정을 이곳에서 관리할 수 있습니다.'
      }
      eyebrow="계정 홈"
      meta={
        <>
          <MetricPill label="기록한 작품" value={totalCount} />
          <MetricPill label="완료" value={completedCount} />
          <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
        </>
      }
      title={isAuthenticated ? '계정 센터' : '계정 안내'}
    >
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro
            description={
              isAuthenticated
                ? `${user?.email ?? '계정'}으로 사용 중입니다. 이 기기와 계정 기록을 연결해 관리합니다.`
                : '게스트 모드에서는 이 기기에만 저장됩니다. 로그인하면 계정 기반 아카이브와 동기화 흐름을 열 수 있습니다.'
            }
            eyebrow="계정 상태"
            title={isAuthenticated ? '로그인된 계정' : '게스트 모드'}
          />

          {isAuthenticated ? (
            <AppLinkButton to="/account/settings">계정 설정 보기</AppLinkButton>
          ) : (
            <Group gap="sm">
              <AppLinkButton to="/auth/login">로그인</AppLinkButton>
              <AppLinkButton to="/auth/register">회원가입</AppLinkButton>
            </Group>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={
              syncAttentionCount > 0
                ? '대기 중이거나 확인이 필요한 동기화 항목이 있습니다.'
                : '대기열, 충돌, 최근 동기화 상태를 이 영역에서 계속 관리합니다.'
            }
            eyebrow="동기화"
            title="동기화 상태"
          />

          <KeyValueGrid
            items={[
              { label: '대기 중', value: `${queueItems.length}건` },
              { label: '충돌', value: `${conflictWorks.length}건` },
              { label: '최근 동기화', value: formatOptionalDate(lastSuccessfulPullAt) },
            ]}
          />

          <Group gap="xs" wrap="wrap">
            <AppBadge tone={syncAttentionCount > 0 ? 'warning' : 'success'}>
              {syncAttentionCount > 0 ? '확인 필요' : '대기 항목 없음'}
            </AppBadge>
            <AppLinkButton to="/account/settings">설정 열기</AppLinkButton>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="테마, 외부 검색 provider, 로컬 백업/복구 같은 개인 기록 운영 설정을 관리합니다."
            eyebrow="설정"
            title="계정·테마·데이터 관리"
          />

          <Group gap="xs" wrap="wrap">
            <AppBadge tone="muted">테마</AppBadge>
            <AppBadge tone="muted">백업</AppBadge>
            <AppBadge tone="muted">계정 정보</AppBadge>
          </Group>

          <AppLinkButton to="/account/settings">설정 열기</AppLinkButton>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="기록 요약 화면은 내 작품 수, 완료 수, 평균 별점, 동기화 상태를 빠르게 보는 개인용 화면입니다."
            eyebrow="기록 요약"
            title="개인 기록 요약"
          />

          <Text c="var(--mantine-color-dimmed)">
            계정 설정과 개인 기록 요약을 분리해 동기화, 백업, 설정 흐름을 명확하게 유지합니다.
          </Text>

          <AppLinkButton to="/profile">기록 요약 보기</AppLinkButton>
        </SectionCard>
      </SimpleGrid>
    </AccountPageTemplate>
  );
}
