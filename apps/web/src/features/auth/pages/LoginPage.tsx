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
          : 'Could not sign in with this account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <PageHero
        description="Open your personal archive on this device and keep sync within reach."
        eyebrow="Account"
        title="Sign in"
        titleAs="h1"
      />

      <AuthForm
        description="Use your email and password to open your account archive."
        footer={
          <div className="stack">
            <p className="muted-copy">
              Need an account?{' '}
              <Link className="inline-link" to="/auth/register">
                Sign up
              </Link>
            </p>
            <p className="muted-copy">
              Prefer guest mode?{' '}
              <Link className="inline-link" to="/works">
                Continue without signing in
              </Link>
            </p>
          </div>
        }
        heading="Sign in"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="Sign in"
      />
    </div>
  );
}
