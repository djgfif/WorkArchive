import { useState } from 'react';
import { Text } from '@mantine/core';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';
import { getAuthSubmitErrorMessage } from '../utils/auth-error-message';

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
      setSubmitError(getAuthSubmitErrorMessage(error, 'login'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="계정 아카이브로 전환하고 자동 백업 상태를 이어서 관리합니다."
      footer={
        <Text c="var(--mantine-color-dimmed)" ta="center">
          계정이 없으신가요?{' '}
          <Link style={{ color: 'var(--mantine-primary-color-filled)', fontWeight: 600 }} to="/auth/register">
            회원가입
          </Link>
        </Text>
      }
      form={
        <AuthForm
          isSubmitting={isSubmitting}
          mode="login"
          onSubmit={handleSubmit}
          showPasswordResetLink
          showRememberMe
          submitError={submitError}
          submitLabel="로그인"
        />
      }
      highlights={[
        {
          description:
            '로그인 전 기록은 사라지지 않습니다. 게스트 기록이 있으면 로그인 후 검토 흐름으로 이어집니다.',
          title: '게스트 기록 보호',
        },
        {
          description:
            '자동 백업과 세션 관리는 계정 영역에서 확인합니다. 문제가 있으면 기록 작성은 유지한 채 다시 시도할 수 있습니다.',
          title: '자동 백업 관리',
        },
      ]}
      title="로그인"
    />
  );
}
