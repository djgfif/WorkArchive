import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function RegisterPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signUp } = useAuthSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(input: AuthCredentialsInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await signUp(input);
      navigate('/');
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
    <div className="stack">
      <PageHero
        description="회원가입하면 기록을 안전하게 보관하고 필요할 때 동기화할 수 있습니다."
        eyebrow="회원가입"
        title="기록 시작하기"
        titleAs="h1"
      />

      <AuthForm
        description="이메일과 비밀번호로 계정을 만들면 바로 시작할 수 있습니다."
        footer={
          <div className="stack">
            <p className="muted-copy">
              이미 계정이 있나요?{' '}
              <Link className="inline-link" to="/auth/login">
                로그인
              </Link>
            </p>
            <p className="muted-copy">
              지금은 게스트로 둘러볼까요?{' '}
              <Link className="inline-link" to="/">
                게스트 모드로 계속하기
              </Link>
            </p>
          </div>
        }
        heading="회원가입"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="회원가입"
      />
    </div>
  );
}
