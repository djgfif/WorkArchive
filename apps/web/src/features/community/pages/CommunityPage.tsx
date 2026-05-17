import { Group, Stack, Text } from '@mantine/core';

import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';

export function CommunityPage() {
  return (
    <FutureFeaturePage
      actions={
        <AppLinkButton to="/works">내 작품 기록으로 돌아가기</AppLinkButton>
      }
      description="Work Archive는 현재 순수 개인용 local-first 아카이브로 개발합니다. 공개 프로필, 공개 리뷰, 팔로우, 댓글, 커뮤니티 피드는 현재 제품 범위 밖입니다."
      eyebrow="범위 밖"
      highlights={[
        {
          title: '개인 기록 우선',
          description:
            '작품 상태, 별점, 리뷰, 진행도, 즐겨찾기 같은 내 기록을 완성하는 일을 먼저 다룹니다.',
        },
        {
          title: '공개 기능 보류',
          description:
            '다른 사용자와 연결되는 기능보다 로컬 백업, 복구, 개인 기록 정리를 먼저 완성합니다.',
        },
        {
          title: '데이터 plane 분리',
          description:
            '개인 기록과 catalog/search 보조 데이터는 분리하고, public/community plane은 현재 구현하지 않습니다.',
        },
      ]}
      footer={
        <Stack gap="sm">
          <Text fw={700}>대체 흐름</Text>
          <Text c="var(--app-text-muted)">
            현재 제품 범위는 개인 기록, 로컬 백업, 제한적 계정 동기화입니다.
            공개 피드처럼 보이는 임시 화면은 만들지 않고, 내 기록을 완성하는
            화면으로 이동합니다.
          </Text>
          <Group gap="sm" wrap="wrap">
            <AppLinkButton to="/works">작품 기록 관리</AppLinkButton>
            <AppLinkButton to="/insights" tone="quiet">
              내 취향 보기
            </AppLinkButton>
          </Group>
        </Stack>
      }
      title="커뮤니티 기능은 현재 만들지 않습니다"
    />
  );
}
