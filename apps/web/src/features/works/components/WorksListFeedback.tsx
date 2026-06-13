import type { WorkRecord } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';

interface WorksListFeedbackProps {
  actionError: string | null;
  actionSuccess: string | null;
  deletedNotice: WorkRecord | null;
  onDismissDeletedNotice: () => void;
  onRestoreDeletedNotice: (work: WorkRecord) => void;
  restoringWorkId: string | null;
  showDeletedNotice: boolean;
}

export function WorksListFeedback({
  actionError,
  actionSuccess,
  deletedNotice,
  onDismissDeletedNotice,
  onRestoreDeletedNotice,
  restoringWorkId,
  showDeletedNotice,
}: WorksListFeedbackProps) {
  const { t } = useAppTranslation();

  return (
    <>
      {actionError && (
        <FeedbackMessage tone="error">{actionError}</FeedbackMessage>
      )}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      {deletedNotice && showDeletedNotice && (
        <FeedbackMessage
          title={t('works.list.deletedNoticeTitle')}
          tone="success"
        >
          <ActionRow justify="space-between">
            <span>
              {t('works.list.deletedNoticeDescription', {
                title: deletedNotice.title,
              })}
            </span>
            <ActionRow justify="flex-end">
              <AppButton
                disabled={restoringWorkId === deletedNotice.id}
                onClick={() => onRestoreDeletedNotice(deletedNotice)}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                {t('works.list.restore')}
              </AppButton>
              <AppButton
                onClick={onDismissDeletedNotice}
                size="compact-sm"
                tone="ghost"
                type="button"
              >
                {t('works.list.close')}
              </AppButton>
            </ActionRow>
          </ActionRow>
        </FeedbackMessage>
      )}
    </>
  );
}
