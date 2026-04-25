import { useState } from 'react';
import { Text } from '@mantine/core';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function RegisterPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signUp } = useAuthSession();
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
      const nextLocation = await signUp(input);
      navigate(nextLocation);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '지금은 회원가입을 완료할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="나만의 아카이브를 시작하세요."
      footer={
        <Text c="var(--app-text-muted)" ta="center">
          이미 계정이 있나요?{' '}
          <Link style={{ color: 'var(--app-accent)', fontWeight: 600 }} to="/auth/login">
            로그인
          </Link>
        </Text>
      }
      form={
        <AuthForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
          submitLabel="회원가입"
        />
      }
      title="회원가입"
    />
  );
}
