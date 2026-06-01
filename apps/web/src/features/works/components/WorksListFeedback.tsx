import type { WorkRecord } from '@work-archive/shared-types';

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
  return (
    <>
      {actionError && (
        <FeedbackMessage tone="error">{actionError}</FeedbackMessage>
      )}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      {deletedNotice && showDeletedNotice && (
        <FeedbackMessage title="휴지통으로 이동했습니다." tone="success">
          <ActionRow justify="space-between">
            <span>{deletedNotice.title} 기록을 되돌릴 수 있습니다.</span>
            <ActionRow justify="flex-end">
              <AppButton
                disabled={restoringWorkId === deletedNotice.id}
                onClick={() => onRestoreDeletedNotice(deletedNotice)}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                되돌리기
              </AppButton>
              <AppButton
                onClick={onDismissDeletedNotice}
                size="compact-sm"
                tone="ghost"
                type="button"
              >
                닫기
              </AppButton>
            </ActionRow>
          </ActionRow>
        </FeedbackMessage>
      )}
    </>
  );
}
