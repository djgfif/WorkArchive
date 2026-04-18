import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

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
      <header className="panel stack">
        <p className="eyebrow">Account Mode</p>
        <h1 className="page-title">Sign in to your account-local archive</h1>
        <p className="muted-copy">
          Guest mode stays available. Signing in opens a separate local archive
          for this account on this device and enables authenticated sync.
        </p>
      </header>

      <AuthForm
        description="Use your email and password to open your account-scoped local archive."
        footer={
          <div className="stack">
            <p className="muted-copy">
              Need an account?{' '}
              <Link className="inline-link" to="/auth/register">
                Sign up
              </Link>
            </p>
            <p className="muted-copy">
              Prefer local-only?{' '}
              <Link className="inline-link" to="/works">
                Continue in guest mode
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
