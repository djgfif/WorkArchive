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

function formatOptionalDate(value: string | null, fallback = '아직 백업 전') {
  return value ? formatWorkDateTime(value) : fallback;
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function AccountOverviewPage() {
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictItems, failedItems, lastSuccessfulPullAt, pendingItems } =
    useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const backupAttentionCount = conflictItems.length + failedItems.length;
  const backupPendingCount = pendingItems.length;

  return (
    <AccountPageTemplate
      actions={<AppLinkButton to="/profile">기록 요약 보기</AppLinkButton>}
      description={
        isAuthenticated
          ? '계정 상태, 자동 백업, 로컬 백업 설정을 한 곳에서 확인합니다.'
          : '지금은 게스트 모드입니다. 로그인하면 자동 백업과 설정을 이곳에서 관리할 수 있습니다.'
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
                ? `${user?.email ?? '계정'}으로 사용 중입니다. 기록은 이 기기에 먼저 저장되고 자동 백업됩니다.`
                : '게스트 모드에서는 이 기기에만 저장됩니다. 로그인하면 자동 백업을 사용할 수 있습니다.'
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
              backupAttentionCount > 0
                ? '자동 백업 중 일부 항목 확인이 필요합니다. 기록 작성은 계속할 수 있습니다.'
                : backupPendingCount > 0
                  ? '최근 변경 사항을 자동으로 백업하는 중입니다. 오프라인에서도 기록할 수 있습니다.'
                  : '기록은 안전하게 보관됩니다. 오프라인에서도 먼저 기록하고 나중에 백업됩니다.'
            }
            eyebrow="자동 백업"
            title="자동 백업 상태"
          />

          <KeyValueGrid
            items={[
              {
                label: '상태',
                value:
                  backupAttentionCount > 0
                    ? '확인이 필요한 항목 있음'
                    : backupPendingCount > 0
                      ? '백업 중'
                      : '기록은 안전하게 보관됨',
              },
              { label: '최근 백업', value: formatOptionalDate(lastSuccessfulPullAt) },
              { label: '오프라인 기록', value: '가능' },
            ]}
          />

          <Group gap="xs" wrap="wrap">
            <AppBadge tone={backupAttentionCount > 0 ? 'warning' : 'success'}>
              {backupAttentionCount > 0 ? '확인 필요' : '정상'}
            </AppBadge>
            <AppLinkButton to="/account/settings">백업 설정</AppLinkButton>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="테마, 외부 검색, 로컬 백업과 복구 설정을 관리합니다."
            eyebrow="설정"
            title="계정과 백업 관리"
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
            description="기록 요약 화면은 내 작품 수, 완료 수, 평균 별점, 최근 기록을 빠르게 보는 개인용 화면입니다."
            eyebrow="기록 요약"
            title="개인 기록 요약"
          />

          <Text c="var(--mantine-color-dimmed)">
            계정 설정과 개인 기록 요약을 분리해 백업과 설정 흐름을 명확하게 유지합니다.
          </Text>

          <AppLinkButton to="/profile">기록 요약 보기</AppLinkButton>
        </SectionCard>
      </SimpleGrid>
    </AccountPageTemplate>
  );
}
