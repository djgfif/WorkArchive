import { AppButton, StateMessage } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';

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
  const { t } = useAppTranslation();

  return (
    <StateMessage
      actions={
        <>
          <AppButton onClick={onRetry} tone="primary" type="button">
            {t('works.list.retry')}
          </AppButton>
          <AppButton
            aria-label={t('works.list.addWorkFromError')}
            onClick={onOpenAddDialog}
            tone="secondary"
            type="button"
          >
            {t('navigation.addWork')}
          </AppButton>
        </>
      }
      description={error}
      title={t('works.list.errorTitle')}
      tone="error"
    />
  );
}
