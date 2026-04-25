import { useState } from 'react';
import { Text } from '@mantine/core';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signIn } = useAuthSession();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isLoading && mode === 'authenticated' && !hasAttemptedSubmit) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(input: AuthCredentialsInput) {
    try {
      setHasAttemptedSubmit(true);
      setIsSubmitting(true);
      setSubmitError(null);
      const nextLocation = await signIn(input);
      navigate(nextLocation);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '로그인하지 못했습니다. 입력한 정보를 확인해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="기록을 계속하려면 로그인하세요."
      footer={
        <Text c="var(--app-text-muted)" ta="center">
          계정이 없으신가요?{' '}
          <Link style={{ color: 'var(--app-accent)', fontWeight: 600 }} to="/auth/register">
            회원가입
          </Link>
        </Text>
      }
      form={
        <AuthForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          showPasswordResetLink
          showRememberMe
          submitError={submitError}
          submitLabel="로그인"
        />
      }
      title="로그인"
    />
  );
}
