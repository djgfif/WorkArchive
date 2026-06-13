import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Avatar, Group, Stack, Text, TextInput } from '@mantine/core';
import type { AuthUserResponse } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { appI18n, useAppTranslation } from '@app/i18n';
import {
  ApiRequestError,
  updateAuthProfile,
} from '@features/auth';
import { getUserAvatarProfile } from '@features/auth';

type SettingsAuthMode = 'authenticated' | 'guest';

interface AccountSettingsSectionProps {
  mode: SettingsAuthMode;
  onUserUpdated(user: AuthUserResponse): void;
  user: AuthUserResponse | null;
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_]*[a-z0-9]$/;
const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'auth',
  'account',
  'settings',
  'works',
  'sync',
  'profile',
]);

function getHandleValidationMessage(handle: string) {
  if (!handle) {
    return null;
  }

  if (
    handle.length < 3 ||
    handle.length > 24 ||
    !HANDLE_PATTERN.test(handle)
  ) {
    return appI18n.t('settings.account.handleInvalid');
  }

  if (RESERVED_HANDLES.has(handle)) {
    return appI18n.t('settings.account.handleReserved');
  }

  return null;
}

function getProfileUpdateErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      return appI18n.t('settings.account.handleTaken');
    }

    if (error.status === 400) {
      return appI18n.t('settings.account.handleFormatInvalid');
    }
  }

  return error instanceof Error
    ? error.message
    : appI18n.t('settings.account.saveError');
}

export function AccountSettingsSection({
  mode,
  onUserUpdated,
  user,
}: AccountSettingsSectionProps) {
  const { t } = useAppTranslation();
  const googleAccount = user?.authAccounts?.find(
    (account) => account.provider === 'google',
  );
  const avatarProfile = getUserAvatarProfile(user);
  const displayName = avatarProfile.displayName;
  const email = avatarProfile.email;
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const previewAvatarUrl = avatarUrl.trim() || googleAccount?.pictureUrl || '';

  useEffect(() => {
    setNickname(user?.nickname ?? '');
    setHandle(user?.handle ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
    setFeedback(null);
  }, [user?.avatarUrl, user?.handle, user?.id, user?.nickname]);

  const handleValidationMessage = useMemo(
    () => getHandleValidationMessage(handle),
    [handle],
  );
  const hasChanges =
    nickname !== (user?.nickname ?? '') ||
    handle !== (user?.handle ?? '') ||
    avatarUrl !== (user?.avatarUrl ?? '');
  const canSave = mode === 'authenticated' && Boolean(user) && hasChanges;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !canSave) {
      return;
    }

    if (handleValidationMessage) {
      setFeedback({
        message: handleValidationMessage,
        tone: 'error',
      });

      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedUser = await updateAuthProfile({
        avatarUrl,
        handle: handle || null,
        nickname,
      });

      onUserUpdated(updatedUser);
      setFeedback({
        message: t('settings.account.saveSuccess'),
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message: getProfileUpdateErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.account.description')}
        eyebrow={t('settings.account.eyebrow')}
        title={t('settings.account.title')}
      />

      {mode !== 'authenticated' || !user ? (
        <Stack gap="sm">
          <Text c="dimmed">
            {t('settings.account.guestDescription')}
          </Text>
          <ActionRow>
            <AppBadge tone="muted">
              {t('settings.account.badgeLocalRecords')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.account.badgeGoogleOptional')}
            </AppBadge>
          </ActionRow>
        </Stack>
      ) : (
        <Stack gap="lg">
          <Group align="center" gap="md" wrap="wrap">
            <Avatar
              color="archive"
              radius="xl"
              size={56}
              src={previewAvatarUrl || null}
            >
              {avatarProfile.initial}
            </Avatar>
            <Stack gap={2}>
              <Text fw={800}>{displayName}</Text>
              <Text c="dimmed" size="sm">
                {email}
              </Text>
              <ActionRow>
                <AppBadge tone={googleAccount ? 'success' : 'warning'}>
                  {googleAccount
                    ? t('settings.account.googleConnected')
                    : t('settings.account.googleRequired')}
                </AppBadge>
                <AppBadge
                  tone={googleAccount?.emailVerified ? 'success' : 'muted'}
                >
                  {googleAccount?.emailVerified
                    ? t('settings.account.emailVerified')
                    : t('settings.account.emailUnknown')}
                </AppBadge>
              </ActionRow>
            </Stack>
          </Group>

          <SectionCard padding="lg" tone="subtle">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <SectionIntro
                  description={t('settings.account.editDescription')}
                  eyebrow={t('settings.account.editEyebrow')}
                  title={t('settings.account.editTitle')}
                  titleOrder={3}
                />
                {feedback && (
                  <FeedbackMessage tone={feedback.tone}>
                    {feedback.message}
                  </FeedbackMessage>
                )}
                <Group align="flex-end" grow>
                  <TextInput
                    label={t('settings.account.displayName')}
                    placeholder={t('settings.account.displayName')}
                    value={nickname}
                    onChange={(event) => setNickname(event.currentTarget.value)}
                  />
                  <TextInput
                    label={t('settings.account.avatarUrl')}
                    placeholder="https://example.com/avatar.jpg"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.currentTarget.value)}
                  />
                  <TextInput
                    error={handleValidationMessage}
                    label="handle"
                    leftSection="@"
                    placeholder="handle"
                    value={handle}
                    onChange={(event) =>
                      setHandle(
                        event.currentTarget.value
                          .replace(/^@+/, '')
                          .trim()
                          .toLowerCase(),
                      )
                    }
                  />
                </Group>
                <ActionRow justify="flex-end">
                  <AppButton
                    disabled={!canSave}
                    loading={isSaving}
                    tone="primary"
                    type="submit"
                  >
                    {t('settings.account.saveProfile')}
                  </AppButton>
                </ActionRow>
              </Stack>
            </form>
          </SectionCard>
        </Stack>
      )}
    </SectionCard>
  );
}
