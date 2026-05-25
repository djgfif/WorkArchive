import { Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
} from '@shared/components/AppPrimitives';
import type { JsonArchiveExportFeedback } from '../hooks/useJsonArchiveExport';
import type { JsonBackupReminderStatus } from '../utils/json-backup-reminder';

interface JsonBackupReminderCardProps {
  feedback?: JsonArchiveExportFeedback | null;
  isExporting: boolean;
  onExportJson: () => void;
  reminder: JsonBackupReminderStatus;
}

export function JsonBackupReminderCard({
  feedback = null,
  isExporting,
  onExportJson,
  reminder,
}: JsonBackupReminderCardProps) {
  if (!reminder.shouldShow) {
    return null;
  }

  return (
    <SectionCard padding="lg" tone="subtle">
      <Stack gap="sm">
        <ActionRow justify="space-between">
          <Stack gap={4}>
            <ActionRow>
              <AppBadge tone="warning">백업 권장</AppBadge>
              <AppBadge tone="muted">JSON</AppBadge>
            </ActionRow>
            <Text fw={800}>{reminder.title}</Text>
          </Stack>
          <AppButton
            disabled={isExporting}
            loading={isExporting}
            onClick={() => void onExportJson()}
            tone="primary"
            type="button"
          >
            JSON 백업 내보내기
          </AppButton>
        </ActionRow>
        <Text c="dimmed" size="sm">
          {reminder.description}
        </Text>
        {feedback && (
          <FeedbackMessage tone={feedback.tone}>
            {feedback.message}
          </FeedbackMessage>
        )}
      </Stack>
    </SectionCard>
  );
}
