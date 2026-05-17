import { Group, Stack, Text } from '@mantine/core';

import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';

export function TierBoardsPage() {
  return (
    <FutureFeaturePage
      actions={
        <AppLinkButton to="/works">작품에서 먼저 정리하기</AppLinkButton>
      }
      description="티어 보드는 작품 목록과 연결되지만, 작품 필드와 섞이지 않는 별도 경험으로 준비합니다."
      eyebrow="티어 보드"
      highlights={[
        {
          title: '개인 보드 목록 먼저',
          description:
            '초기 진입은 외부 순위가 아니라 내 보드 목록과 주제 선택이 먼저 보이도록 설계합니다.',
        },
        {
          title: '템플릿 기반 시작',
          description:
            'S~F 템플릿과 주제별 보드 생성을 준비해 작품 관리 화면과 분리된 감상 정리 경험을 만듭니다.',
        },
        {
          title: '로컬 기록 기반',
          description:
            '보드는 내 작품 기록에서만 출발하며 공개 프로필이나 커뮤니티 연결은 현재 범위에 포함하지 않습니다.',
        },
      ]}
      footer={
        <Stack gap="sm">
          <Text fw={700}>지금은 작품 기록을 먼저 정리할 수 있습니다</Text>
          <Text c="var(--app-text-muted)">
            티어 보드는 아직 저장 가능한 기능으로 노출하지 않습니다. 대신 작품별
            별점, 상태, 개인 태그를 정리해두면 이후 보드 기능의 기준 데이터로
            이어갈 수 있습니다.
          </Text>
          <Group gap="sm" wrap="wrap">
            <AppLinkButton to="/works">작품 목록 보기</AppLinkButton>
            <AppLinkButton to="/works/new" tone="primary">
              작품 추가
            </AppLinkButton>
          </Group>
        </Stack>
      }
      title="티어 보드"
    />
  );
}
