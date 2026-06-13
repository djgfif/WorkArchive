import { Paper, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'restored';

interface AddWorkSaveFooterProps {
  duplicateCount: number;
  isSubmitting: boolean;
  onCancel?: () => void;
  saveStatus: DraftSaveStatus;
}

export function AddWorkSaveFooter({
  duplicateCount,
  isSubmitting,
  onCancel,
  saveStatus,
}: AddWorkSaveFooterProps) {
  const { t } = useAppTranslation();

  return (
    <Paper className={cn(css.addWorkSaveFooter)} p="sm" radius="lg" withBorder>
      <Stack gap="xs">
        {duplicateCount > 0 && (
          <ActionRow>
            <AppBadge tone="warning">
              {t('works.add.save.duplicateTitle')}
            </AppBadge>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {t('works.add.save.duplicateDescription', {
                count: duplicateCount,
              })}
            </Text>
          </ActionRow>
        )}
        <ActionRow>
          <AppButton
            disabled={isSubmitting}
            fullWidth
            size="lg"
            tone="primary"
            type="submit"
          >
            {isSubmitting ? t('works.form.saving') : t('works.add.save.submit')}
          </AppButton>
          {onCancel ? (
            <AppButton onClick={onCancel} tone="quiet" type="button">
              {t('works.form.cancel')}
            </AppButton>
          ) : (
            <AppLinkButton to="/works" tone="quiet">
              {t('works.form.cancel')}
            </AppLinkButton>
          )}
          {saveStatus === 'saving' && (
            <AppBadge tone="muted">{t('works.form.draftSaving')}</AppBadge>
          )}
          {saveStatus === 'saved' && (
            <AppBadge tone="success">{t('works.form.draftSaved')}</AppBadge>
          )}
          {saveStatus === 'restored' && (
            <AppBadge tone="accent">{t('works.form.draftRestored')}</AppBadge>
          )}
        </ActionRow>
      </Stack>
    </Paper>
  );
}
