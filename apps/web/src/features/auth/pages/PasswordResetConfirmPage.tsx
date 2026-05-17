import { useState, type FormEvent } from 'react';
import { PasswordInput, Stack, Text } from '@mantine/core';
import { Link, useSearchParams } from 'react-router-dom';

import {
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmPasswordReset } from '../services/auth.api';
import { getAuthSubmitErrorMessage } from '../utils/auth-error-message';

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
      setSubmitError(getAuthSubmitErrorMessage(error, 'password-reset-confirm'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="복구 링크가 유효하면 새 비밀번호를 저장하고 다시 로그인할 수 있습니다."
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
              description="8자 이상 새 비밀번호를 입력해주세요."
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
            {submitError && (
              <FeedbackMessage title="저장하지 못했습니다" tone="error">
                {submitError}
              </FeedbackMessage>
            )}
            {successMessage && (
              <FeedbackMessage title="비밀번호를 저장했습니다" tone="success">
                {successMessage}
              </FeedbackMessage>
            )}

            <AppButton
              disabled={!token || isSubmitting || successMessage !== null}
              fullWidth
              loading={isSubmitting}
              tone="primary"
              type="submit"
            >
              {isSubmitting ? '저장 중...' : '새 비밀번호 저장'}
            </AppButton>
          </Stack>
        </form>
      }
      highlights={[
        {
          description:
            '복구 링크가 없거나 만료된 경우에는 다시 요청해야 합니다. 이미 저장된 작품 기록은 그대로 유지됩니다.',
          title: '복구 링크 확인',
        },
      ]}
      title="새 비밀번호 저장"
    />
  );
}
