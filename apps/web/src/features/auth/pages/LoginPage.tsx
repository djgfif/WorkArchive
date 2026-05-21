import { Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import { fetchGoogleAuthStatus } from '../services/auth.api';

function getReturnToFromLocationState(state: unknown) {
  if (
    typeof state === 'object' &&
    state !== null &&
    'returnTo' in state &&
    typeof state.returnTo === 'string'
  ) {
    return state.returnTo;
  }

  return undefined;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { continueWithGoogle, isLoading, mode } = useAuthSession();
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const returnTo = getReturnToFromLocationState(location.state);
  const googleStatus = new URLSearchParams(location.search).get('google');
  const googleFailed = googleStatus === 'failed';
  const googleUnconfigured = googleStatus === 'unconfigured';
  const googleAvailable = googleConfigured && !googleUnconfigured;

  useEffect(() => {
    let isCancelled = false;

    async function loadGoogleStatus() {
      try {
        const status = await fetchGoogleAuthStatus();

        if (!isCancelled) {
          setGoogleConfigured(status.configured);
        }
      } catch {
        if (!isCancelled) {
          setGoogleConfigured(true);
        }
      }
    }

    void loadGoogleStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/" />;
  }

  return (
    <AuthPageTemplate
      description="로그인은 필수가 아닙니다. Google은 비공개 백업, 여러 기기 동기화, 개인 API key vault를 위해 사용하며 기록은 먼저 이 기기에 저장됩니다."
      footer={
        <Text c="var(--mantine-color-dimmed)" ta="center">
          Work Archive는 사용자의 비밀번호를 저장하지 않습니다. Google 계정은 백업 연결에만 사용됩니다.
        </Text>
      }
      form={
        <AuthForm
          googleConfigured={googleAvailable}
          googleUnavailableDetail={
            <>
              현재 이 환경에서는 Google 로그인을 사용할 수 없습니다. 로그인 없이 계속 사용할 수 있습니다.
              {import.meta.env.DEV && (
                <>
                  <br />
                  개발 환경: 서버의 Google OAuth 설정을 확인하세요.
                </>
              )}
            </>
          }
          onContinueAsGuest={() => navigate('/works')}
          onContinueWithGoogle={() => continueWithGoogle?.(returnTo)}
          submitError={
            googleFailed
              ? '다시 시도하거나 로그인 없이 계속할 수 있습니다.'
                : null
          }
          submitErrorTitle={
            googleFailed
              ? 'Google 로그인을 완료하지 못했습니다.'
                : undefined
          }
        />
      }
      highlights={[
        {
          description:
            '로그인 전에도 작품과 감상 기록은 브라우저 로컬 저장소에 먼저 남습니다.',
          title: '로그인 전 기록 가능',
        },
        {
          description:
            '필요할 때만 Google 계정으로 비공개 백업과 여러 기기 동기화를 켭니다.',
          title: '백업은 선택 사항',
        },
        {
          description:
            '나중에 연결해도 기존 게스트 기록은 transfer review에서 옮길 항목을 검토합니다.',
          title: '기록 이전 검토',
        },
      ]}
      title="기록은 바로 시작하고, 백업은 Google로 연결하세요"
    />
  );
}
