import { Paper, Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'restored';

function cn(value: string | undefined) {
  return value ?? '';
}

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
  return (
    <Paper className={cn(css.addWorkSaveFooter)} p="sm" radius="lg" withBorder>
      <Stack gap="xs">
        {duplicateCount > 0 && (
          <ActionRow>
            <AppBadge tone="warning">기존 기록 확인 필요</AppBadge>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              비슷한 기록 {duplicateCount}개를 확인한 뒤 저장하세요.
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
            {isSubmitting ? '저장 중...' : '내 아카이브에 저장'}
          </AppButton>
          {onCancel ? (
            <AppButton onClick={onCancel} tone="quiet" type="button">
              취소
            </AppButton>
          ) : (
            <AppLinkButton to="/works" tone="quiet">
              취소
            </AppLinkButton>
          )}
          {saveStatus === 'saving' && (
            <AppBadge tone="muted">임시저장 중</AppBadge>
          )}
          {saveStatus === 'saved' && (
            <AppBadge tone="success">임시저장됨</AppBadge>
          )}
          {saveStatus === 'restored' && (
            <AppBadge tone="accent">임시작성 복구됨</AppBadge>
          )}
        </ActionRow>
      </Stack>
    </Paper>
  );
}
