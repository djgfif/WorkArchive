import { useState } from 'react';
import { Text } from '@mantine/core';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';
import { getAuthSubmitErrorMessage } from '../utils/auth-error-message';

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
      setSubmitError(getAuthSubmitErrorMessage(error, 'register'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageTemplate
      description="개인 작품 기록을 계정 아카이브로 백업하고 이어서 관리합니다."
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
          mode="register"
          onSubmit={handleSubmit}
          submitError={submitError}
          submitLabel="회원가입"
        />
      }
      highlights={[
        {
          description:
            '회원가입 후에도 작품 추가와 수정은 IndexedDB 로컬 저장 경로를 먼저 사용합니다.',
          title: 'local-first 유지',
        },
        {
          description:
            '이 계정은 개인 백업과 제한적 동기화를 위한 계정이며, 공개 프로필이나 커뮤니티 피드를 만들지 않습니다.',
          title: '개인 기록 전용',
        },
      ]}
      title="회원가입"
    />
  );
}
