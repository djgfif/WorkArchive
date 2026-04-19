import { Link } from 'react-router-dom';

import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';

export function SettingsPage() {
  return (
    <FutureFeaturePage
      actions={
        <Link className="secondary-link" to="/profile">
          프로필로 돌아가기
        </Link>
      }
      description="설정은 프로필 하위에서 계정, 동기화, 테마와 환경 구성을 관리하는 공간으로 준비합니다."
      eyebrow="설정"
      highlights={[
        {
          title: '계정 설정',
          description: '공개 범위, 계정 정보, 프로필 노출 정책을 여기에 모읍니다.',
        },
        {
          title: '동기화 설정',
          description:
            '수동 동기화는 이미 사용할 수 있고, 이후 자동 동기화 정책도 이 계층에서 다룹니다.',
        },
        {
          title: '환경 설정',
          description:
            '테마와 표시 밀도처럼 서비스 경험을 조정하는 옵션이 이곳에 들어올 예정입니다.',
        },
      ]}
      title="설정"
    />
  );
}
