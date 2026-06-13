import { Affix, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
} from '@shared/components/AppPrimitives';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

type WorkFormDraftSaveStatus = 'idle' | 'saving' | 'saved' | 'restored';

interface WorkFormDraftNoticeProps {
  onApplyDraft: () => void;
  onClearDraft: () => void;
}

export function WorkFormDraftNotice({
  onApplyDraft,
  onClearDraft,
}: WorkFormDraftNoticeProps) {
  const { t } = useAppTranslation();

  return (
    <FeedbackMessage title={t('works.form.draftNoticeTitle')} tone="info">
      <ActionRow justify="space-between">
        <Text c="inherit">{t('works.form.draftNoticeDescription')}</Text>
        <ActionRow justify="flex-end">
          <AppButton
            onClick={onApplyDraft}
            size="compact-sm"
            tone="secondary"
            type="button"
          >
            {t('works.form.draftApply')}
          </AppButton>
          <AppButton
            onClick={onClearDraft}
            size="compact-sm"
            tone="ghost"
            type="button"
          >
            {t('works.form.draftClear')}
          </AppButton>
        </ActionRow>
      </ActionRow>
    </FeedbackMessage>
  );
}

interface WorkFormSubmitActionsProps {
  cancelTo: string;
  isSubmitting: boolean;
  saveStatus: WorkFormDraftSaveStatus;
  submitButtonLabel: string;
}

export function WorkFormSubmitActions({
  cancelTo,
  isSubmitting,
  saveStatus,
  submitButtonLabel,
}: WorkFormSubmitActionsProps) {
  const { t } = useAppTranslation();

  return (
    <ActionRow>
      <AppButton
        disabled={isSubmitting}
        loading={isSubmitting}
        tone="primary"
        type="submit"
      >
        {submitButtonLabel}
      </AppButton>
      <AppLinkButton to={cancelTo} tone="quiet">
        {t('works.form.cancel')}
      </AppLinkButton>
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
  );
}

interface WorkFormMobileSaveAffixProps {
  cancelTo: string;
  isSubmitting: boolean;
  mobileActionSummary: string;
  saveStatus: WorkFormDraftSaveStatus;
  submitButtonLabel: string;
  submitLabel: string;
}

export function WorkFormMobileSaveAffix({
  cancelTo,
  isSubmitting,
  mobileActionSummary,
  saveStatus,
  submitButtonLabel,
  submitLabel,
}: WorkFormMobileSaveAffixProps) {
  const { t } = useAppTranslation();

  return (
    <Affix bottom={12} hiddenFrom="sm" left={12} right={12} zIndex={200}>
      <SectionCard
        className={cn(css.mobileSaveAffix)}
        gap="xs"
        padding="sm"
        tone="default"
      >
        <Text c="dimmed" fw={700} lineClamp={1} size="xs">
          {mobileActionSummary}
        </Text>
        <ActionRow>
          <AppButton
            aria-label={t('works.form.mobileSubmitAria', {
              label: submitLabel,
            })}
            disabled={isSubmitting}
            fullWidth
            loading={isSubmitting}
            tone="primary"
            type="submit"
          >
            {submitButtonLabel}
          </AppButton>
          <AppLinkButton to={cancelTo} tone="quiet">
            {t('works.form.cancel')}
          </AppLinkButton>
          {saveStatus === 'saved' && (
            <AppBadge tone="success">{t('works.form.draftSaved')}</AppBadge>
          )}
        </ActionRow>
      </SectionCard>
    </Affix>
  );
}
