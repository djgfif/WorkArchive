import { AppLinkButton } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { useArchiveSafetyState } from '../hooks/useArchiveSafetyState';

export function SyncSafetyBadge() {
  const { t } = useAppTranslation();
  const { presentation } = useArchiveSafetyState();

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
