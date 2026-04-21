import { useState } from 'react';
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
      description="계정을 만들면 기록을 이어서 관리하고, 필요할 때 동기화와 설정으로 자연스럽게 확장할 수 있습니다."
      eyebrow="회원가입"
      footer={
        <div className="stack">
          <p className="muted-copy">
            이미 계정이 있나요?{' '}
            <Link className="inline-link" to="/auth/login">
              로그인
            </Link>
          </p>
          <p className="muted-copy">
            아직은 가볍게 시작하고 싶다면{' '}
            <Link className="inline-link" to="/">
              게스트 모드로 계속하기
            </Link>
          </p>
        </div>
      }
      form={
        <AuthForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
          submitLabel="회원가입"
        />
      }
      highlights={[
        {
          title: '게스트에서 자연스럽게 확장',
          description: '처음에는 가볍게 쓰고, 필요할 때만 계정 기반 흐름으로 넘어갑니다.',
        },
        {
          title: '계정 센터로 이어짐',
          description: '동기화, 공개 범위, 설정 구조는 회원가입 이후에 차분하게 이어집니다.',
        },
      ]}
      title="내 아카이브 시작하기"
    />
  );
}
