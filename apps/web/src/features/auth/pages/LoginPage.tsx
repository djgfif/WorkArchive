import { Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
  usePageTitle(t('auth.login.pageTitle'));
  const location = useLocation();
  const navigate = useNavigate();
  const { continueWithGoogle, isLoading, mode, sessionStatus } =
    useAuthSession();
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const didCleanUrlRef = useRef(false);

  const returnTo = getReturnToFromLocationState(location.state);

  // 마운트 시점에 URL 파라미터를 읽어 state로 올림
  // → URL을 클린업한 뒤에도 에러 표시가 사라지지 않도록
  const initialParams = useRef(new URLSearchParams(location.search));
  const initialGoogleStatus = initialParams.current.get('google');
  const [googleFailed, setGoogleFailed] = useState(
    initialGoogleStatus === 'failed',
  );
  const googleUnconfigured = initialGoogleStatus === 'unconfigured';
  const googleAvailable = googleConfigured && !googleUnconfigured;

  // 실패 파라미터를 URL에서 제거 — 새로고침 시 에러 재표시 방지, 뒤로가기 히스토리 오염 방지
  useEffect(() => {
    if (initialGoogleStatus && !didCleanUrlRef.current) {
      didCleanUrlRef.current = true;
      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete('google');
      const cleanSearch = cleanParams.toString();
      navigate(
        { search: cleanSearch ? `?${cleanSearch}` : '' },
        { replace: true, state: location.state },
      );
    }
  }, [initialGoogleStatus, location.search, location.state, navigate]);

  useEffect(() => {
    let isCancelled = false;

    async function loadGoogleStatus() {
      try {
        const status = await fetchGoogleAuthStatus();
        if (!isCancelled) setGoogleConfigured(status.configured);
      } catch {
        if (!isCancelled) setGoogleConfigured(true);
      }
    }

    void loadGoogleStatus();
    return () => {
      isCancelled = true;
    };
  }, []);

  if (
    !isLoading &&
    mode === 'authenticated' &&
    sessionStatus === 'authenticated'
  ) {
    return <Navigate replace to={returnTo ?? '/'} />;
  }

  function handleRetryWithGoogle() {
    setGoogleFailed(false);
    continueWithGoogle?.(returnTo);
  }

  return (
    <AuthPageTemplate
      description={t('auth.login.description')}
      footer={
        <Text c="var(--mantine-color-dimmed)" ta="center">
          {t('auth.login.footer')}
        </Text>
      }
      form={
        <AuthForm
          googleConfigured={googleAvailable}
          googleUnavailableDetail={
            <>
              {t('auth.form.googleUnavailableDetail')}
              {import.meta.env.DEV && (
                <>
                  <br />
                  {t('auth.form.googleUnavailableDevHint')}
                </>
              )}
            </>
          }
          onContinueAsGuest={() => navigate('/works')}
          onContinueWithGoogle={() => continueWithGoogle?.(returnTo)}
          {...(googleFailed
            ? { onRetryWithGoogle: handleRetryWithGoogle }
            : {})}
          submitError={googleFailed ? t('auth.login.failedDescription') : null}
          {...(googleFailed
            ? { submitErrorTitle: t('auth.login.failedTitle') }
            : {})}
        />
      }
      highlights={[
        {
          description: t('auth.login.highlightLocalDescription'),
          title: t('auth.login.highlightLocalTitle'),
        },
        {
          description: t('auth.login.highlightBackupDescription'),
          title: t('auth.login.highlightBackupTitle'),
        },
        {
          description: t('auth.login.highlightTransferDescription'),
          title: t('auth.login.highlightTransferTitle'),
        },
      ]}
      title={
        <>
          {t('auth.login.titleLine1')}
          <br />
          {t('auth.login.titleLine2')}
        </>
      }
    />
  );
}
