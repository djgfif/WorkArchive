import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Stack, Text, Title } from '@mantine/core';

import { useAppTranslation, type AppTranslationKey } from '@app/i18n';
import { AppButton, AppLinkButton } from '@shared/components/AppPrimitives';
import { useAuthSession } from '../hooks/useAuthSession';
import { ApiRequestError } from '../services/auth.api';

/* ── 에러 유형 ─────────────────────────────────────────────────────────────── */

type AuthCompleteError =
  | { kind: 'timeout' }
  | { kind: 'network' }
  | { kind: 'session' }
  | { kind: 'oauth_denied' }
  | { kind: 'oauth_unconfigured' }
  | { kind: 'unknown'; message: string };

function classifyError(error: unknown): AuthCompleteError {
  if (error instanceof ApiRequestError) {
    if (error.failureKind === 'timeout') {
      return { kind: 'timeout' };
    }

    if (error.status === 0) {
      return { kind: 'network' };
    }

    if (error.status === 401 || error.status === 403) {
      return { kind: 'session' };
    }
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (error.name === 'AbortError' || error.message === 'timeout') {
      return { kind: 'timeout' };
    }
    if (
      normalizedMessage.includes('fetch') ||
      normalizedMessage.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError')
    ) {
      return { kind: 'network' };
    }
    if (error.message.includes('session could not be restored')) {
      return { kind: 'session' };
    }
  }
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

const ERROR_COPY_KEYS: Record<
  AuthCompleteError['kind'],
  { title: AppTranslationKey; detail: AppTranslationKey }
> = {
  timeout: {
    title: 'auth.googleComplete.errorTimeoutTitle',
    detail: 'auth.googleComplete.errorTimeoutDetail',
  },
  network: {
    title: 'auth.googleComplete.errorNetworkTitle',
    detail: 'auth.googleComplete.errorNetworkDetail',
  },
  session: {
    title: 'auth.googleComplete.errorSessionTitle',
    detail: 'auth.googleComplete.errorSessionDetail',
  },
  oauth_denied: {
    title: 'auth.googleComplete.errorOauthDeniedTitle',
    detail: 'auth.googleComplete.errorOauthDeniedDetail',
  },
  oauth_unconfigured: {
    title: 'auth.googleComplete.errorOauthUnconfiguredTitle',
    detail: 'auth.googleComplete.errorOauthUnconfiguredDetail',
  },
  unknown: {
    title: 'auth.googleComplete.errorUnknownTitle',
    detail: 'auth.googleComplete.errorUnknownDetail',
  },
};

const COMPLETE_TIMEOUT_MS = 12_000;

type OAuthCallbackErrorKind = Extract<
  AuthCompleteError['kind'],
  'oauth_denied' | 'oauth_unconfigured'
>;

function getOAuthErrorKind(param: string | null): OAuthCallbackErrorKind | null {
  if (param === 'failed' || param === 'denied' || param === 'cancelled') {
    return 'oauth_denied';
  }

  if (param === 'unconfigured') {
    return 'oauth_unconfigured';
  }

  return null;
}

/* ── 로딩 단계 표시 ─────────────────────────────────────────────────────────── */

type LoadingStep = 'verifying' | 'restoring' | 'redirecting';

const STEP_LABEL_KEYS: Record<LoadingStep, AppTranslationKey> = {
  verifying: 'auth.googleComplete.stepVerifying',
  restoring: 'auth.googleComplete.stepRestoring',
  redirecting: 'auth.googleComplete.stepRedirecting',
};

function StepDots({ step }: { step: LoadingStep }) {
  const { t } = useAppTranslation();
  const steps: LoadingStep[] = ['verifying', 'restoring', 'redirecting'];
  const currentIndex = steps.indexOf(step);

  return (
    <Stack gap="xs" align="center">
      <Box style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <Box
            key={s}
            style={{
              width: i === currentIndex ? 20 : 6,
              height: 6,
              borderRadius: 999,
              background: i <= currentIndex
                ? 'var(--app-accent-primary)'
                : 'var(--app-border-default)',
              transition:
                'width 300ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms ease',
            }}
          />
        ))}
      </Box>
      <Text c="dimmed" size="sm" ta="center">
        {t(STEP_LABEL_KEYS[step])}
      </Text>
    </Stack>
  );
}

/* ── 에러 패널 ──────────────────────────────────────────────────────────────── */

interface ErrorPanelProps {
  error: AuthCompleteError;
  onRetry: () => void;
}

function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const { t } = useAppTranslation();
  const { title, detail } = ERROR_COPY_KEYS[error.kind];

  return (
    <Stack gap="xl" align="center" maw={400} mx="auto">
      <Box
        aria-hidden="true"
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--app-state-danger) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--app-state-danger) 22%, transparent)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--app-state-danger)',
          fontSize: '1.35rem',
          lineHeight: 1,
        }}
      >
        ✕
      </Box>

      <Stack gap={6} ta="center">
        <Title order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
          {t(title)}
        </Title>
        <Text c="dimmed" size="sm" maw="34ch" mx="auto" style={{ lineHeight: 1.65 }}>
          {t(detail)}
        </Text>
        {error.kind === 'unknown' && import.meta.env.DEV && (
          <Text
            c="dimmed"
            size="xs"
            mt={4}
            style={{ fontFamily: 'monospace', opacity: 0.6 }}
          >
            {error.message}
          </Text>
        )}
      </Stack>

      <Stack gap="sm" w="100%">
        <AppButton fullWidth onClick={onRetry} tone="primary" type="button">
          {t('auth.googleComplete.retry')}
        </AppButton>
        <AppLinkButton fullWidth to="/auth/login" tone="secondary">
          {t('auth.googleComplete.loginPage')}
        </AppLinkButton>
        <AppLinkButton fullWidth to="/works" tone="quiet">
          {t('auth.googleComplete.guestContinue')}
        </AppLinkButton>
      </Stack>
    </Stack>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────────────────────────────────────── */

export function GoogleAuthCompletePage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeGoogleSignIn, continueWithGoogle, isLoading } = useAuthSession();

  const completionPromiseRef = useRef<Promise<string> | null>(null);
  const didSettleRef = useRef(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('verifying');
  const [error, setError] = useState<AuthCompleteError | null>(null);

  // API가 실패를 쿼리 파라미터로 알려준 경우 (Google callback에서 거부됨)
  const oauthParam = searchParams.get('google');
  const oauthErrorKind = getOAuthErrorKind(oauthParam);

  useEffect(() => {
    if (oauthErrorKind !== null) {
      didSettleRef.current = true;
      setError({ kind: oauthErrorKind });
    }
  }, [oauthErrorKind]);

  useEffect(() => {
    if (error !== null) return;
    if (oauthErrorKind !== null) return;
    if (isLoading) return;

    let isCancelled = false;

    const timeoutId = setTimeout(() => {
      if (!isCancelled && !didSettleRef.current) {
        didSettleRef.current = true;
        setError({ kind: 'timeout' });
      }
    }, COMPLETE_TIMEOUT_MS);

    async function getCompletionPromise() {
      if (completionPromiseRef.current) {
        return completionPromiseRef.current;
      }

      try {
        if (!completeGoogleSignIn) {
          throw new Error('Google sign-in completion is unavailable.');
        }

        setLoadingStep('restoring');
        completionPromiseRef.current = completeGoogleSignIn();

        return await completionPromiseRef.current;
      } catch (err) {
        completionPromiseRef.current = null;
        throw err;
      }
    }

    async function complete() {
      try {
        setLoadingStep('restoring');
        const nextLocation = await getCompletionPromise();
        if (isCancelled || didSettleRef.current) return;
        didSettleRef.current = true;
        clearTimeout(timeoutId);

        setLoadingStep('redirecting');
        // 짧은 딜레이로 "이동 준비 중" 단계를 인지시킴
        await new Promise<void>((r) => setTimeout(r, 150));

        if (!isCancelled) {
          navigate(nextLocation, { replace: true });
        }
      } catch (err: unknown) {
        if (isCancelled || didSettleRef.current) return;
        didSettleRef.current = true;
        clearTimeout(timeoutId);
        setError(classifyError(err));
      }
    }

    void complete();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [completeGoogleSignIn, error, isLoading, navigate, oauthErrorKind]);

  function handleRetry() {
    // sessionStorage에 저장된 returnTo를 그대로 사용해 Google 로그인 재시작
    setError(null);
    didSettleRef.current = false;
    completionPromiseRef.current = null;

    if (continueWithGoogle) {
      continueWithGoogle();
      return;
    }

    navigate('/auth/login', { replace: true });
  }

  if (error) {
    return (
      <Box
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(1.5rem, 4vw, 3rem)',
          animation: 'pageEnter 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <ErrorPanel error={error} onRetry={handleRetry} />
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        animation: 'pageEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {/* 스피너 */}
      <Box
        aria-hidden="true"
        role="status"
        aria-label={t('auth.googleComplete.loadingAria')}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: '2.5px solid var(--app-border-default)',
          borderTopColor: 'var(--app-accent-primary)',
          animation: 'googleAuthSpin 700ms linear infinite',
        }}
      />

      <Stack gap="lg" align="center">
        <Stack gap={6} align="center">
          <Title order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
            {t('auth.googleComplete.loadingTitle')}
          </Title>
          <Text c="dimmed" size="sm" ta="center">
            {t('auth.googleComplete.loadingDescription')}
          </Text>
        </Stack>

        <StepDots step={loadingStep} />
      </Stack>

      <style>{`
        @keyframes googleAuthSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}
