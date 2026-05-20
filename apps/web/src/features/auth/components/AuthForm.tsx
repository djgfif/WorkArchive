import { Divider, Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';

interface AuthFormProps {
  isSubmitting?: boolean;
  onContinueAsGuest?: () => void;
  onContinueWithGoogle: () => void;
  submitError?: string | null;
}

export function AuthForm({
  isSubmitting = false,
  onContinueAsGuest,
  onContinueWithGoogle,
  submitError = null,
}: AuthFormProps) {
  return (
    <Stack gap="md">
      <AppButton
        disabled={isSubmitting}
        fullWidth
        loading={isSubmitting}
        onClick={onContinueWithGoogle}
        tone="primary"
        type="button"
      >
        Google로 계속하기
      </AppButton>

      <Text c="var(--mantine-color-dimmed)" size="sm">
        Google 로그인은 비공개 백업, 여러 기기 동기화, 계정별 API key vault를
        연결하기 위한 선택 사항입니다.
      </Text>

      <Divider color="var(--app-border-subtle)" />

      <Stack gap="xs">
        <Text fw={700}>게스트로 계속 사용</Text>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          로그인하지 않아도 이 기기에서 작품을 만들고 수정하고 export할 수 있습니다.
        </Text>
        {onContinueAsGuest && (
          <ActionRow>
            <AppButton
              disabled={isSubmitting}
              fullWidth
              onClick={onContinueAsGuest}
              tone="secondary"
              type="button"
            >
              게스트로 계속하기
            </AppButton>
          </ActionRow>
        )}
      </Stack>

      {submitError && (
        <FeedbackMessage title="로그인을 완료하지 못했습니다" tone="error">
          {submitError}
        </FeedbackMessage>
      )}
    </Stack>
  );
}
