import { useState, type FormEvent } from 'react';
import { PasswordInput, Stack, TextInput } from '@mantine/core';

import {
  ActionRow,
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
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

        {submitError && <FeedbackMessage tone="error">{submitError}</FeedbackMessage>}

        <ActionRow>
          <AppButton disabled={isSubmitting} tone="primary" type="submit">
            {isSubmitting ? `${submitLabel} 중...` : submitLabel}
          </AppButton>
        </ActionRow>
      </Stack>
    </form>
  );
}
