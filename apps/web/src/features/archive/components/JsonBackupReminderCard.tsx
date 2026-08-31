import { Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();

  if (!reminder.shouldShow) {
    return null;
  }

  return (
    <SectionCard padding="lg" tone="subtle">
      <Stack gap="sm">
        <ActionRow justify="space-between">
          <Stack gap={4}>
            <ActionRow>
              <AppBadge tone="default">
                {t('archive.backup.warningBadge')}
              </AppBadge>
              <AppBadge tone="muted">{t('archive.backup.mutedBadge')}</AppBadge>
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
            {t('archive.backup.exportJson')}
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
