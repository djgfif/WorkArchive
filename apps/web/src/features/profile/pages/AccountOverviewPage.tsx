import { Badge, Group, SimpleGrid, Text } from '@mantine/core';

import {
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

  return (
    <AccountPageTemplate
      actions={<AppLinkButton to="/profile">프로필 보기</AppLinkButton>}
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
            description="대기열, 충돌, 최근 동기화 상태를 이 영역에서 계속 관리합니다."
            eyebrow="동기화"
            title="계정 보조 기능"
          />

          <KeyValueGrid
            items={[
              { label: '대기 중', value: `${queueItems.length}건` },
              { label: '충돌', value: `${conflictWorks.length}건` },
              { label: '최근 동기화', value: formatOptionalDate(lastSuccessfulPullAt) },
            ]}
          />

          <AppLinkButton to="/account/sync">동기화 열기</AppLinkButton>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="테마, 외부 검색 provider, 로컬 백업/복구 같은 개인 기록 운영 설정을 관리합니다."
            eyebrow="설정"
            title="계정·테마·데이터 관리"
          />

          <Group gap="xs" wrap="wrap">
            <Badge>테마</Badge>
            <Badge>백업</Badge>
            <Badge>계정 정보</Badge>
          </Group>

          <AppLinkButton to="/account/settings">설정 열기</AppLinkButton>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="프로필 화면은 내 기록 요약을 보는 개인용 화면으로 유지합니다. 공개 SNS 기능은 현재 제품 범위에 포함하지 않습니다."
            eyebrow="프로필"
            title="개인 기록 프로필"
          />

          <Text c="var(--app-text-muted)">
            계정 설정과 개인 기록 프로필을 분리해 동기화, 백업, 설정 흐름을 명확하게 유지합니다.
          </Text>

          <AppLinkButton to="/profile">프로필 보기</AppLinkButton>
        </SectionCard>
      </SimpleGrid>
    </AccountPageTemplate>
  );
}
