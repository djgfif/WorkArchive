import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { StateMessage } from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../hooks/useAuthSession';

export function GoogleAuthCompletePage() {
  const navigate = useNavigate();
  const { completeGoogleSignIn, isLoading } = useAuthSession();
  const hasStartedRef = useRef(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (isLoading || hasStartedRef.current) {
      return;
    }

    let isCancelled = false;
    hasStartedRef.current = true;

    async function complete() {
      try {
        if (!completeGoogleSignIn) {
          throw new Error('Google sign-in completion is unavailable.');
        }

        const nextLocation = await completeGoogleSignIn();

        if (!isCancelled) {
          navigate(nextLocation, {
            replace: true,
          });
        }
      } catch {
        if (!isCancelled) {
          setHasFailed(true);
        }
      }
    }

    void complete();

    return () => {
      isCancelled = true;
    };
  }, [completeGoogleSignIn, isLoading, navigate]);

  if (hasFailed) {
    return <Navigate replace to="/auth/login?google=failed" />;
  }

  return (
    <StateMessage
      description="Google 로그인 결과를 기존 refresh 세션으로 복구하고 있습니다."
      eyebrow="계정 연결"
      title="세션을 확인하는 중입니다"
      tone="loading"
    />
  );
}
