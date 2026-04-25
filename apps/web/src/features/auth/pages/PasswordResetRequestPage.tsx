import { useState, type FormEvent } from 'react';
import { Anchor, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';

import {
  AppButton,
  FeedbackMessage,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { requestPasswordReset } from '../services/auth.api';

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [developmentResetUrl, setDevelopmentResetUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setDevelopmentResetUrl(null);
      const response = await requestPasswordReset(email);

      setMessage(response.message);
      setDevelopmentResetUrl(response.developmentResetUrl ?? null);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '비밀번호 재설정 요청을 처리하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="가입한 이메일을 입력하면 개발용 재설정 링크를 확인할 수 있습니다."
      eyebrow="비밀번호 재설정"
      footer={
        <Text c="var(--app-text-muted)">
          비밀번호가 기억났다면{' '}
          <Link style={{ color: 'var(--app-accent)', fontWeight: 600 }} to="/auth/login">
            로그인으로 돌아가기
          </Link>
        </Text>
      }
      form={
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Stack gap="md">
            <TextInput
              autoComplete="email"
              label="이메일"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />

            {submitError && <FeedbackMessage tone="error">{submitError}</FeedbackMessage>}
            {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}

            {developmentResetUrl && (
              <SectionCard gap="sm" padding="md" tone="subtle">
                <Text fw={700}>개발용 복구 링크</Text>
                <Text c="var(--app-text-muted)" size="sm">
                  메일 발송 대신 로컬 개발 확인을 위해 이 링크를 표시합니다.
                </Text>
                <Anchor href={developmentResetUrl}>{developmentResetUrl}</Anchor>
              </SectionCard>
            )}

            <AppButton disabled={isSubmitting} fullWidth tone="primary" type="submit">
              {isSubmitting ? '요청 중...' : '재설정 링크 만들기'}
            </AppButton>
          </Stack>
        </form>
      }
      highlights={[]}
      title="비밀번호 다시 설정하기"
    />
  );
}
