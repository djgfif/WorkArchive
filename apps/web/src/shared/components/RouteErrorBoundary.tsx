import { useRouteError } from 'react-router-dom';
import { useEffect } from 'react';

import { useAppTranslation } from '@app/i18n';
import { AppButton, AppLinkButton, StateMessage } from './AppPrimitives';
import { getRouteErrorDescription } from './route-error-description';

interface RouteErrorBoundaryProps {
  fallbackPath: string;
  fallbackLabel: string;
  title: string;
}

export function RouteErrorBoundary({
  fallbackLabel,
  fallbackPath,
  title,
}: RouteErrorBoundaryProps) {
  const { t } = useAppTranslation();
  const error = useRouteError();

  useEffect(() => {
    console.error(
      'Route error boundary caught an unrecoverable route error.',
      error,
    );
  }, [error]);

  return (
    <StateMessage
      actions={
        <>
          <AppButton onClick={() => window.location.reload()} tone="primary">
            {t('shared.routeError.retry')}
          </AppButton>
          <AppLinkButton to={fallbackPath} tone="quiet">
            {fallbackLabel}
          </AppLinkButton>
        </>
      }
      description={t('shared.routeError.description', {
        detail: getRouteErrorDescription(error),
      })}
      eyebrow={t('shared.routeError.eyebrow')}
      title={title}
      tone="error"
    />
  );
}
