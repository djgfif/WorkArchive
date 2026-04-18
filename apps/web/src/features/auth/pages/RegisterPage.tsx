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
      <PageHero
        description="Create an account archive for this device while keeping guest mode available whenever you need it."
        eyebrow="Create Account"
        title="Start your account archive"
        titleAs="h1"
      />

      <AuthForm
        description="Register with an email and password. After sign-up, the app opens your signed-in archive."
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
