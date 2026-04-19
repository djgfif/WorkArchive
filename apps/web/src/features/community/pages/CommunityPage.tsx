import { Link } from 'react-router-dom';

import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';

export function CommunityPage() {
  return (
    <FutureFeaturePage
      actions={
        <Link className="secondary-link" to="/profile">
          프로필 구조 보기
        </Link>
      }
      description="커뮤니티는 메인 탭에 포함되지만, 현재 단계에서는 개인 기록이 중심이라는 원칙을 유지합니다."
      eyebrow="커뮤니티"
      highlights={[
        {
          title: '정보형 허브로 시작',
          description:
            '과도한 피드 대신 인기 작품, 많이 기록된 작품, 대표 한줄평 같은 가벼운 허브 구조를 우선합니다.',
        },
        {
          title: '작품 단위 연결',
          description:
            '작품 공개 페이지, 프로필, 티어 보드와 연결되는 정보형 반응 레이어를 준비합니다.',
        },
        {
          title: '소란스럽지 않은 분위기',
          description:
            '추천과 취향 공유는 살리되, 개인 기록 서비스의 차분한 인상을 해치지 않는 방향으로 확장합니다.',
        },
      ]}
      title="커뮤니티"
    />
  );
}
