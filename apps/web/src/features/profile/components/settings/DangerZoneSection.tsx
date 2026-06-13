import { Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { formatAppNumber, useAppTranslation } from '@app/i18n';
import { confirmDialogAdapter } from '@shared/runtime/dialog-adapter';
import styles from './SettingsControlCenter.module.css';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles;

interface DangerZoneSectionProps {
  mode: SettingsAuthMode;
  onRevokeAllSessions: () => void;
  revokingSessionId: string | null;
  sessionCount: number;
}

export function DangerZoneSection({
  mode,
  onRevokeAllSessions,
  revokingSessionId,
  sessionCount,
}: DangerZoneSectionProps) {
  const { t } = useAppTranslation();

  async function handleRevokeAllSessions() {
    const shouldRevoke = await confirmDialogAdapter.confirm({
      title: t('settings.danger.confirmLogoutAllTitle'),
      description: t('settings.danger.confirmLogoutAllDescription'),
    });

    if (!shouldRevoke) {
      return;
    }

    onRevokeAllSessions();
  }

  return (
    <SectionCard className={css.dangerCard ?? ''}>
      <SectionIntro
        description={t('settings.danger.description')}
        eyebrow={t('settings.danger.eyebrow')}
        title={t('settings.danger.title')}
      />

      <SectionCard padding="lg" tone="subtle">
        <Stack gap="sm">
          <ActionRow>
            <Text fw={800}>{t('settings.danger.logoutAllTitle')}</Text>
            <AppBadge tone={mode === 'authenticated' ? 'danger' : 'muted'}>
              {mode === 'authenticated'
                ? t('settings.danger.activeSessionCount', {
                    count: formatAppNumber(sessionCount),
                  })
                : t('settings.danger.loginRequired')}
            </AppBadge>
          </ActionRow>
          <Text c="dimmed" size="sm">
            {t('settings.danger.logoutAllDescription')}
          </Text>
          <ActionRow>
            <AppButton
              disabled={mode !== 'authenticated'}
              loading={revokingSessionId === 'all'}
              onClick={() => void handleRevokeAllSessions()}
              tone="danger"
              type="button"
            >
              {t('settings.danger.logoutAllTitle')}
            </AppButton>
          </ActionRow>
        </Stack>
      </SectionCard>
    </SectionCard>
  );
}
