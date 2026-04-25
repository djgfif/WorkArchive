import { useState, type FormEvent } from 'react';
import { PasswordInput, Stack, Text } from '@mantine/core';
import { Link, useSearchParams } from 'react-router-dom';

import {
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmPasswordReset } from '../services/auth.api';

export function PasswordResetConfirmPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setSubmitError('비밀번호 재설정 링크가 올바르지 않습니다.');

      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const response = await confirmPasswordReset({
        password,
        token,
      });

      setSuccessMessage(response.message);
      setPassword('');
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '비밀번호를 재설정하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="개발용 복구 링크로 들어왔다면 새 비밀번호를 저장할 수 있습니다."
      eyebrow="새 비밀번호"
      footer={
        <Text c="var(--app-text-muted)">
          재설정을 마쳤다면{' '}
          <Link style={{ color: 'var(--app-accent)', fontWeight: 600 }} to="/auth/login">
            로그인으로 돌아가기
          </Link>
        </Text>
      }
      form={
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Stack gap="md">
            <PasswordInput
              autoComplete="new-password"
              disabled={!token || successMessage !== null}
              label="새 비밀번호"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              value={password}
            />

            {!token && (
              <FeedbackMessage tone="error">
                비밀번호 재설정 링크가 올바르지 않습니다.
              </FeedbackMessage>
            )}
            {submitError && <FeedbackMessage tone="error">{submitError}</FeedbackMessage>}
            {successMessage && (
              <FeedbackMessage tone="success">{successMessage}</FeedbackMessage>
            )}

            <AppButton
              disabled={!token || isSubmitting || successMessage !== null}
              fullWidth
              tone="primary"
              type="submit"
            >
              {isSubmitting ? '저장 중...' : '새 비밀번호 저장'}
            </AppButton>
          </Stack>
        </form>
      }
      highlights={[]}
      title="새 비밀번호 저장"
    />
  );
}
