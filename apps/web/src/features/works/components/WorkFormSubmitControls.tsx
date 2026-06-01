import { Affix, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
} from '@shared/components/AppPrimitives';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

type WorkFormDraftSaveStatus = 'idle' | 'saving' | 'saved' | 'restored';

function cn(value: string | undefined) {
  return value ?? '';
}

interface WorkFormDraftNoticeProps {
  onApplyDraft: () => void;
  onClearDraft: () => void;
}

export function WorkFormDraftNotice({
  onApplyDraft,
  onClearDraft,
}: WorkFormDraftNoticeProps) {
  return (
    <FeedbackMessage title="임시작성 있음" tone="info">
      <ActionRow justify="space-between">
        <Text c="inherit">이전에 작성하던 내용이 있습니다.</Text>
        <ActionRow justify="flex-end">
          <AppButton
            onClick={onApplyDraft}
            size="compact-sm"
            tone="secondary"
            type="button"
          >
            이어서 작성하기
          </AppButton>
          <AppButton
            onClick={onClearDraft}
            size="compact-sm"
            tone="ghost"
            type="button"
          >
            임시작성 삭제
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
        취소
      </AppLinkButton>
      {saveStatus === 'saving' && <AppBadge tone="muted">임시저장 중</AppBadge>}
      {saveStatus === 'saved' && <AppBadge tone="success">임시저장됨</AppBadge>}
      {saveStatus === 'restored' && (
        <AppBadge tone="accent">임시작성 복구됨</AppBadge>
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
            aria-label={`${submitLabel} 하단 고정 저장`}
            disabled={isSubmitting}
            fullWidth
            loading={isSubmitting}
            tone="primary"
            type="submit"
          >
            {submitButtonLabel}
          </AppButton>
          <AppLinkButton to={cancelTo} tone="quiet">
            취소
          </AppLinkButton>
          {saveStatus === 'saved' && (
            <AppBadge tone="success">임시저장됨</AppBadge>
          )}
        </ActionRow>
      </SectionCard>
    </Affix>
  );
}
