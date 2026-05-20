import { Text } from '@mantine/core';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { continueWithGoogle, isLoading, mode } = useAuthSession();
  const googleFailed =
    new URLSearchParams(location.search).get('google') === 'failed';

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/" />;
  }

  return (
    <AuthPageTemplate
      description="로그인은 기록 작성의 필수 조건이 아닙니다. Google 계정은 비공개 백업, 다중 기기 동기화, 개인 API key vault를 연결할 때 사용합니다."
      footer={
        <Text c="var(--mantine-color-dimmed)" ta="center">
          이메일/비밀번호 가입과 로그인은 더 이상 새 UI에서 제공하지 않습니다.
        </Text>
      }
      form={
        <AuthForm
          onContinueAsGuest={() => navigate('/works')}
          onContinueWithGoogle={continueWithGoogle ?? (() => undefined)}
          submitError={
            googleFailed
              ? 'Google 로그인을 완료하지 못했습니다. 다시 시도하거나 게스트로 계속 사용할 수 있습니다.'
              : null
          }
        />
      }
      highlights={[
        {
          description:
            '게스트 기록은 이 기기에 남아 있으며 로그인 직후 기존 transfer review에서 계정 아카이브로 옮길 항목을 검토합니다.',
          title: '게스트 기록 유지',
        },
        {
          description:
            '계정 연결 후에도 refresh cookie 기반 세션 복구와 로그아웃/세션 해제 흐름은 기존 구조를 사용합니다.',
          title: '기존 세션 구조 재사용',
        },
      ]}
      title="Google로 계정 연결"
    />
  );
}
