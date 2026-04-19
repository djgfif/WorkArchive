import { Link } from 'react-router-dom';

import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';

export function InsightsPage() {
  return (
    <FutureFeaturePage
      actions={
        <Link className="secondary-link" to="/works">
          작품 기록 보러가기
        </Link>
      }
      description="인사이트는 저장된 기록을 의미 있는 취향 정보로 바꾸는 메인 탭입니다. 이번 단계에서는 자리를 먼저 고정합니다."
      eyebrow="인사이트"
      highlights={[
        {
          title: '기록량 요약',
          description:
            '총 작품 수, 상태 분포, 최근 기록 추이를 인사이트 화면의 첫 레이어로 준비합니다.',
        },
        {
          title: '평점과 취향 분석',
          description:
            '평균 별점, 높은 평가 작품, 타입별 선호 흐름 같은 카드형 요약이 들어올 예정입니다.',
        },
        {
          title: '프로필 연결',
          description:
            '인사이트에서 프로필과 작품 목록으로 자연스럽게 이동할 수 있는 해석형 화면을 목표로 둡니다.',
        },
      ]}
      title="인사이트"
    />
  );
}
