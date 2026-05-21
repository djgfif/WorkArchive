import type { ReactNode } from 'react';
import { Divider, Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';

import styles from './AuthForm.module.css';

const css = {
  authStack: styles.authStack ?? '',
  ctaHelper: styles.ctaHelper ?? '',
  googleCta: styles.googleCta ?? '',
  googleIcon: styles.googleIcon ?? '',
  guestPanel: styles.guestPanel ?? '',
};

interface AuthFormProps {
  googleConfigured?: boolean;
  isSubmitting?: boolean;
  onContinueAsGuest?: () => void;
  onContinueWithGoogle: () => void;
  submitError?: ReactNode;
  submitErrorTitle?: ReactNode;
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className={css.googleIcon}
      focusable="false"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthForm({
  googleConfigured = true,
  isSubmitting = false,
  onContinueAsGuest,
  onContinueWithGoogle,
  submitError = null,
  submitErrorTitle = '로그인을 완료하지 못했습니다',
}: AuthFormProps) {
  const googleDisabled = isSubmitting || !googleConfigured;

  return (
    <Stack className={css.authStack} gap="md">
      <AppButton
        className={css.googleCta}
        disabled={googleDisabled}
        fullWidth
        leftSection={<GoogleIcon />}
        loading={isSubmitting}
        onClick={onContinueWithGoogle}
        tone="secondary"
        type="button"
      >
        Google로 백업 연결
      </AppButton>

      <Text c="var(--mantine-color-dimmed)" className={css.ctaHelper} size="sm">
        비공개 백업 · 여러 기기 동기화 · 개인 API key vault
      </Text>

      {!googleConfigured && (
        <FeedbackMessage title="Google OAuth 설정 필요" tone="info">
          현재 이 환경에서는 Google 로그인을 사용할 수 없습니다. 로그인 없이 계속 사용할 수 있습니다.
        </FeedbackMessage>
      )}

      <Divider color="var(--app-border-subtle)" />

      <Stack className={css.guestPanel} gap="xs">
        <Text fw={700}>로컬 기록으로 바로 시작</Text>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          이 기기에 먼저 저장하고, 나중에 Google로 백업을 연결할 수 있습니다.
        </Text>
        {onContinueAsGuest && (
          <ActionRow>
            <AppButton
              disabled={isSubmitting}
              fullWidth
              onClick={onContinueAsGuest}
              tone="secondary"
              type="button"
            >
              로그인 없이 시작하기
            </AppButton>
          </ActionRow>
        )}
      </Stack>

      {submitError && (
        <FeedbackMessage title={submitErrorTitle} tone="error">
          {submitError}
        </FeedbackMessage>
      )}
    </Stack>
  );
}
