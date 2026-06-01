import {
  AppButton,
  StateMessage,
} from '@shared/components/AppPrimitives';

interface WorksListErrorStateProps {
  error: string;
  onOpenAddDialog: () => void;
  onRetry: () => void;
}

export function WorksListErrorState({
  error,
  onOpenAddDialog,
  onRetry,
}: WorksListErrorStateProps) {
  return (
    <StateMessage
      actions={
        <>
          <AppButton onClick={onRetry} tone="primary" type="button">
            다시 불러오기
          </AppButton>
          <AppButton
            aria-label="목록 오류 상태에서 작품 추가"
            onClick={onOpenAddDialog}
            tone="secondary"
            type="button"
          >
            작품 추가
          </AppButton>
        </>
      }
      description={error}
      title="작품 목록을 불러오지 못했습니다."
      tone="error"
    />
  );
}
