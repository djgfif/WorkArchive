import { Stack, Text } from '@mantine/core';
import type { AuthRefreshSessionResponse } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  appI18n,
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
} from '@app/i18n';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';

type SettingsAuthMode = 'authenticated' | 'guest';

interface SecuritySettingsSectionProps {
  feedback: SettingsFeedback | null;
  isLoadingSessions: boolean;
  mode: SettingsAuthMode;
  onRefreshSessions: () => void;
  onRevokeSession: (session: AuthRefreshSessionResponse) => void;
  revokingSessionId: string | null;
  sessions: AuthRefreshSessionResponse[];
}

type TranslationFn = ReturnType<typeof useAppTranslation>['t'];

function formatSessionDate(value: string | null, t: TranslationFn) {
  if (!value) {
    return t('settings.security.never');
  }

  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatUserAgent(value: string | null) {
  if (!value) {
    return appI18n.t('settings.security.noInfo');
  }

  if (!/[()/]/.test(value)) {
    return value.slice(0, 80);
  }

  const browser = value.includes('Edg/')
    ? 'Edge'
    : value.includes('Chrome/')
      ? 'Chrome'
      : value.includes('Firefox/')
        ? 'Firefox'
        : value.includes('Safari/')
          ? 'Safari'
          : appI18n.t('settings.security.browser');
  const os = value.includes('Windows')
    ? 'Windows'
    : value.includes('Mac OS X')
      ? 'macOS'
      : value.includes('Android')
        ? 'Android'
        : value.includes('iPhone') || value.includes('iPad')
          ? 'iOS'
          : value.includes('Linux')
            ? 'Linux'
            : null;
  const label = [browser, os].filter(Boolean).join(' · ');

  return label || value.slice(0, 80);
}

function maskIpAddress(value: string | null) {
  if (!value) {
    return appI18n.t('settings.security.noInfo');
  }

  if (value.includes(':')) {
    const segments = value.split(':').filter(Boolean);

    return segments.length > 1
      ? `${segments.slice(0, 2).join(':')}:…`
      : `${value.slice(0, 6)}…`;
  }

  const parts = value.split('.');

  return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.x` : value;
}

export function SecuritySettingsSection({
  feedback,
  isLoadingSessions,
  mode,
  onRefreshSessions,
  onRevokeSession,
  revokingSessionId,
  sessions,
}: SecuritySettingsSectionProps) {
  const { t } = useAppTranslation();
  const hasSessions = sessions.length > 0;

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.security.description')}
        eyebrow={t('settings.security.eyebrow')}
        title={t('settings.security.title')}
      />

      <SectionCard padding="lg" tone="subtle">
        <SectionIntro
          description={
            mode === 'authenticated'
              ? t('settings.security.methodAuthenticated')
              : t('settings.security.methodGuest')
          }
          eyebrow={t('settings.security.methodEyebrow')}
          title={
            mode === 'authenticated'
              ? t('settings.security.googleAccount')
              : t('settings.security.guestMode')
          }
          titleOrder={3}
        />
        <ActionRow>
          <AppBadge tone={mode === 'authenticated' ? 'success' : 'muted'}>
            {mode === 'authenticated'
              ? t('settings.security.authBadgeGoogleOnly')
              : t('settings.security.authBadgeLocalFirstGuest')}
          </AppBadge>
          <AppBadge tone="muted">
            {t('settings.security.noPasswordLogin')}
          </AppBadge>
        </ActionRow>
      </SectionCard>

      {mode !== 'authenticated' ? (
        <Text c="dimmed">{t('settings.security.guestSessionDescription')}</Text>
      ) : isLoadingSessions ? (
        <Text aria-busy="true" c="dimmed">
          {t('settings.security.loadingSessions')}
        </Text>
      ) : !hasSessions ? (
        <Text c="dimmed">{t('settings.security.emptySessions')}</Text>
      ) : (
        <Stack gap="sm">
          <ActionRow>
            <AppBadge tone="success">
              {t('settings.security.activeSessions', {
                count: formatAppNumber(sessions.length),
              })}
            </AppBadge>
            <AppBadge tone="accent">
              {t('settings.security.rememberSessions', {
                count: formatAppNumber(
                  sessions.filter((session) => session.rememberMe).length,
                ),
              })}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.security.currentDeviceSessions', {
                count: formatAppNumber(
                  sessions.filter((session) => session.current).length,
                ),
              })}
            </AppBadge>
          </ActionRow>

          {sessions.map((session) => (
            <SectionCard key={session.id} padding="md" tone="subtle">
              <Stack gap="xs">
                <ActionRow>
                  <Text fw={800}>
                    {session.current
                      ? t('settings.security.currentDevice')
                      : t('settings.security.otherDevice')}
                  </Text>
                  <AppBadge tone={session.current ? 'success' : 'muted'}>
                    {session.current
                      ? t('settings.security.thisDevice')
                      : t('settings.security.active')}
                  </AppBadge>
                  <AppBadge tone={session.rememberMe ? 'accent' : 'muted'}>
                    {session.rememberMe
                      ? t('settings.security.rememberLogin')
                      : t('settings.security.browserSession')}
                  </AppBadge>
                </ActionRow>

                <Text c="dimmed" size="sm">
                  {t('settings.security.sessionDates', {
                    createdAt: formatSessionDate(session.createdAt, t),
                    expiresAt: formatSessionDate(session.expiresAt, t),
                    lastUsedAt: formatSessionDate(session.lastUsedAt, t),
                  })}
                </Text>
                <Text c="dimmed" lineClamp={1} size="sm">
                  {t('settings.security.sessionDevice', {
                    ip: maskIpAddress(session.ipAddress),
                    userAgent: formatUserAgent(session.userAgent),
                  })}
                </Text>

                <ActionRow>
                  <AppButton
                    loading={revokingSessionId === session.id}
                    onClick={() => onRevokeSession(session)}
                    tone={session.current ? 'danger' : 'secondary'}
                    type="button"
                  >
                    {session.current
                      ? t('settings.security.logoutThisDevice')
                      : t('settings.security.revokeSession')}
                  </AppButton>
                </ActionRow>
              </Stack>
            </SectionCard>
          ))}

          <ActionRow>
            <AppButton
              disabled={revokingSessionId !== null}
              onClick={onRefreshSessions}
              tone="quiet"
              type="button"
            >
              {t('settings.security.retry')}
            </AppButton>
          </ActionRow>
        </Stack>
      )}

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          {feedback.message}
        </FeedbackMessage>
      )}
    </SectionCard>
  );
}
