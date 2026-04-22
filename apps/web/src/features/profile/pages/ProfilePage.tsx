import { Badge, Group, SimpleGrid, Text } from '@mantine/core';

import {
  AppLinkButton,
  KeyValueGrid,
  MetricPill,
  SectionCard,
  SectionIntro,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
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

export function ProfilePage() {
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';

  return (
    <DetailPageTemplate>
      <PageHero
        actions={
          <>
            <AppLinkButton to="/account">계정 센터</AppLinkButton>
            <AppLinkButton to="/works">작품 보기</AppLinkButton>
          </>
        }
        description={
          isAuthenticated
            ? '개인 취향 아카이브의 얼굴이 되는 프로필 화면입니다. 계정 관리와 동기화는 별도 계정 센터로 분리했습니다.'
            : '지금은 게스트 모드이지만, 프로필은 앞으로 공개 취향 아카이브로 확장될 메인 목적지입니다.'
        }
        eyebrow="프로필"
        meta={
          <>
            <MetricPill label="기록한 작품" value={totalCount} />
            <MetricPill label="완료" value={completedCount} />
            <MetricPill label="평균 별점" value={formatAverageRating(averageRating)} />
          </>
        }
        title={isAuthenticated ? '내 프로필' : '내 아카이브 프로필'}
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro
            description={
              isAuthenticated
                ? `${user?.email ?? '계정'} 기준으로 기록을 모으고 있습니다. 대표 작품, 공개 소개, 티어 보드가 앞으로 이 구조에 연결됩니다.`
                : '로그인하지 않아도 기록은 시작할 수 있습니다. 계정을 만들면 이 흐름을 계정 프로필로 자연스럽게 이어갈 수 있습니다.'
            }
            eyebrow="프로필 소개"
            title={isAuthenticated ? '내 취향 아카이브' : '게스트 프로필 미리보기'}
          />

          <Group gap="xs" wrap="wrap">
            <Badge>대표 작품</Badge>
            <Badge>공개 소개</Badge>
            <Badge>취향 요약</Badge>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="프로필은 기록량과 감상 흐름을 보여주는 목적지입니다. 관리 동작은 계정 센터에서 이어집니다."
            eyebrow="기록 요약"
            title="지금 보이는 아카이브 상태"
          />

          <KeyValueGrid
            items={[
              { label: '대기 중', value: `${queueItems.length}건` },
              { label: '충돌', value: `${conflictWorks.length}건` },
              { label: '최근 동기화', value: formatOptionalDate(lastSuccessfulPullAt) },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="동기화, 설정, 공개 범위는 메인 프로필 흐름과 분리된 관리 영역에서 차분하게 다룹니다."
            eyebrow="계정 센터"
            title="관리 기능은 따로 분리했습니다"
          />

          <Group gap="sm">
            <AppLinkButton to="/account">계정 센터 열기</AppLinkButton>
            <AppLinkButton to="/account/sync">동기화 바로가기</AppLinkButton>
          </Group>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description="앞으로는 대표 작품, 공개 티어 보드, 요약 소개가 이 자리에서 연결됩니다. 지금은 구조만 먼저 확보합니다."
            eyebrow="공개 프로필"
            title="취향 소개 공간"
          />

          <Text c="var(--app-text-muted)">
            개인 기록과 공개 표면을 분리해 이후 확장 시 충돌을 줄이는 방향으로 준비합니다.
          </Text>

          <Group gap="xs" wrap="wrap">
            <Badge>대표 작품</Badge>
            <Badge>공개 리스트</Badge>
            <Badge>티어 보드</Badge>
          </Group>
        </SectionCard>
      </SimpleGrid>
    </DetailPageTemplate>
  );
}
