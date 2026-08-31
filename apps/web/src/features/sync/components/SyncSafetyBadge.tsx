import { AppLinkButton } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { useArchiveSafetyState } from '../hooks/useArchiveSafetyState';

export function SyncSafetyBadge() {
  const { t } = useAppTranslation();
  const { isLoading, presentation, state } = useArchiveSafetyState();

  if (isLoading || (state.level !== 'action' && state.level !== 'pending')) {
    return null;
  }

  return (
    <AppLinkButton
      aria-label={t('sync.badgeAria', { label: presentation.badge.label })}
      size="compact-sm"
      to={presentation.badge.to}
      tone={presentation.badge.tone}
    >
      {presentation.badge.label}
    </AppLinkButton>
  );
}
