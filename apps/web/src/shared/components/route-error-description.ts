import { appI18n } from '@app/i18n';

export function getRouteErrorDescription(
  error: unknown,
  isDevelopment = import.meta.env.DEV,
) {
  if (isDevelopment && error instanceof Error && error.message.trim()) {
    return appI18n.t('shared.routeError.detailWithReason', {
      reason: error.message,
    });
  }

  return appI18n.t('shared.routeError.detail');
}
