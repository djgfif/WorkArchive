import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageTemplate } from '../../../shared/components/PageTemplates';
import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signIn } = useAuthSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(input: AuthCredentialsInput) {
    try {
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
      description="저장한 기록을 바로 이어서 보고, 필요할 때 동기화와 계정 관리로 연결합니다."
      eyebrow="로그인"
      footer={
        <div className="stack">
          <p className="muted-copy">
            아직 계정이 없나요?{' '}
            <Link className="inline-link" to="/auth/register">
              회원가입
            </Link>
          </p>
          <p className="muted-copy">
            먼저 둘러보고 싶다면{' '}
            <Link className="inline-link" to="/">
              게스트로 계속하기
            </Link>
          </p>
        </div>
      }
      form={
        <AuthForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
          submitLabel="로그인"
        />
      }
      highlights={[
        {
          title: '기록을 바로 이어보기',
          description: '홈과 작품 기록 흐름이 그대로 이어져 다시 시작하기 쉽습니다.',
        },
        {
          title: '동기화는 여기서부터',
          description: '로그인 후에는 계정 센터에서 수동 동기화를 관리할 수 있습니다.',
        },
      ]}
      title="내 기록 이어서 보기"
    />
  );
}
