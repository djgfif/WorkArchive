import { useState, type FormEvent } from 'react';
import { Checkbox, Group, PasswordInput, Stack, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';

import {
  ActionRow,
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import type { AuthCredentialsInput } from '../services/auth.api';

interface AuthFormProps {
  isSubmitting: boolean;
  onSubmit(input: AuthCredentialsInput): Promise<void>;
  showPasswordResetLink?: boolean;
  showRememberMe?: boolean;
  submitError: string | null;
  submitLabel: string;
}

export function AuthForm({
  isSubmitting,
  onSubmit,
  showPasswordResetLink = false,
  showRememberMe = false,
  submitError,
  submitLabel,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      email,
      password,
      ...(showRememberMe ? { rememberMe } : {}),
    });
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Stack gap="md">
        <TextInput
          autoComplete="email"
          label="이메일"
          name="email"
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
          type="email"
          value={email}
        />

        <PasswordInput
          autoComplete="current-password"
          label="비밀번호"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
          value={password}
        />

        {(showRememberMe || showPasswordResetLink) && (
          <Group justify="space-between" wrap="wrap">
            {showRememberMe && (
              <Checkbox
                checked={rememberMe}
                label="로그인 상태 유지"
                name="rememberMe"
                onChange={(event) => setRememberMe(event.currentTarget.checked)}
              />
            )}
            {showPasswordResetLink && (
              <Link
                style={{ color: 'var(--app-accent)', fontWeight: 600 }}
                to="/auth/password-reset"
              >
                비밀번호를 잊으셨나요?
              </Link>
            )}
          </Group>
        )}

        {submitError && <FeedbackMessage tone="error">{submitError}</FeedbackMessage>}

        <ActionRow>
          <AppButton disabled={isSubmitting} fullWidth tone="primary" type="submit">
            {isSubmitting ? `${submitLabel} 중...` : submitLabel}
          </AppButton>
        </ActionRow>
      </Stack>
    </form>
  );
}
