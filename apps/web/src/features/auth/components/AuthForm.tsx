import { useState, type FormEvent } from 'react';

import type { AuthCredentialsInput } from '../services/auth.api';

interface AuthFormProps {
  isSubmitting: boolean;
  onSubmit(input: AuthCredentialsInput): Promise<void>;
  submitError: string | null;
  submitLabel: string;
}

export function AuthForm({
  isSubmitting,
  onSubmit,
  submitError,
  submitLabel,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      email,
      password,
    });
  }

  return (
    <form className="auth-form stack" onSubmit={(event) => void handleSubmit(event)}>
      <label className="field">
        <span>이메일</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>비밀번호</span>
        <input
          autoComplete="current-password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {submitError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {submitError}
        </div>
      )}

      <div className="button-row">
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? `${submitLabel} 중...` : submitLabel}
        </button>
      </div>
    </form>
  );
}
