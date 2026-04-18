import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthForm } from '../components/AuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import type { AuthCredentialsInput } from '../services/auth.api';

export function RegisterPage() {
  const navigate = useNavigate();
  const { isLoading, mode, signUp } = useAuthSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isLoading && mode === 'authenticated') {
    return <Navigate replace to="/works" />;
  }

  async function handleSubmit(input: AuthCredentialsInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await signUp(input);
      navigate('/works');
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Could not create this account right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <header className="panel stack">
        <p className="eyebrow">Create Account</p>
        <h1 className="page-title">Create a user-scoped archive</h1>
        <p className="muted-copy">
          Account mode keeps a separate IndexedDB archive per signed-in user on
          this device. Guest/local data remains available when you sign out.
        </p>
      </header>

      <AuthForm
        description="Register with an email and password. After sign-up, the app switches into your account-local archive on this device."
        footer={
          <div className="stack">
            <p className="muted-copy">
              Already have an account?{' '}
              <Link className="inline-link" to="/auth/login">
                Sign in
              </Link>
            </p>
            <p className="muted-copy">
              Stay local-only for now?{' '}
              <Link className="inline-link" to="/works">
                Continue in guest mode
              </Link>
            </p>
          </div>
        }
        heading="Sign up"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="Create account"
      />
    </div>
  );
}
