import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signIn } = useAuthSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/works" />;
  }

  async function handleSubmit(input: AuthCredentialsInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await signIn(input);
      navigate('/works');
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
    <div className="stack">
      <PageHero
        description="이 기기에서 내 아카이브를 열고 동기화를 사용할 수 있습니다."
        eyebrow="계정"
        title="로그인"
        titleAs="h1"
      />

      <AuthForm
        description="이메일과 비밀번호로 계정 아카이브에 로그인하세요."
        footer={
          <div className="stack">
            <p className="muted-copy">
              아직 계정이 없나요?{' '}
              <Link className="inline-link" to="/auth/register">
                회원가입
              </Link>
            </p>
            <p className="muted-copy">
              게스트 모드로 둘러볼까요?{' '}
              <Link className="inline-link" to="/works">
                로그인 없이 계속하기
              </Link>
            </p>
          </div>
        }
        heading="로그인"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="로그인"
      />
    </div>
  );
}
