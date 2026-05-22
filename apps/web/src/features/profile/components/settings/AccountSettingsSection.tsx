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
} from '../../../../shared/components/AppPrimitives';
import {
  ApiRequestError,
  updateAuthProfile,
} from '../../../auth';
import { getUserAvatarProfile } from '../../../auth';

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
    return 'handle은 3~24자의 영문 소문자, 숫자, 밑줄만 사용할 수 있고 앞뒤 밑줄은 사용할 수 없습니다.';
  }

  if (RESERVED_HANDLES.has(handle)) {
    return '예약된 handle입니다. 다른 handle을 입력해 주세요.';
  }

  return null;
}

function getProfileUpdateErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      return '이미 사용 중인 handle입니다.';
    }

    if (error.status === 400) {
      return 'handle 형식을 다시 확인해 주세요. 3~24자의 영문 소문자, 숫자, 밑줄만 사용할 수 있습니다.';
    }
  }

  return error instanceof Error
    ? error.message
    : '프로필을 저장하지 못했습니다.';
}

export function AccountSettingsSection({
  mode,
  onUserUpdated,
  user,
}: AccountSettingsSectionProps) {
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
        message: '프로필 변경 사항을 저장했습니다.',
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
        description="Work Archive의 계정 표기와 Google 연결 상태를 확인합니다. 로그인 방식은 Google 전용 정책을 유지합니다."
        eyebrow="계정"
        title="계정 프로필"
      />

      {mode !== 'authenticated' || !user ? (
        <Stack gap="sm">
          <Text c="dimmed">
            게스트 모드에서는 기록 작성, 수정, JSON/CSV 백업을 계속 사용할 수
            있습니다. 자동 백업과 개인 API key vault가 필요하면 Google 계정으로
            연결하세요.
          </Text>
          <ActionRow>
            <AppBadge tone="muted">로컬 기록 사용 가능</AppBadge>
            <AppBadge tone="muted">Google 연결 선택 사항</AppBadge>
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
                  {googleAccount ? 'Google 연결됨' : 'Google 연결 필요'}
                </AppBadge>
                <AppBadge
                  tone={googleAccount?.emailVerified ? 'success' : 'muted'}
                >
                  {googleAccount?.emailVerified
                    ? '이메일 검증됨'
                    : '검증 정보 없음'}
                </AppBadge>
              </ActionRow>
            </Stack>
          </Group>

          <SectionCard padding="lg" tone="subtle">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <SectionIntro
                  description="표시 이름과 handle은 Work Archive 안에서 보이는 프로필 정보입니다. 로그인 방식은 Google 연결만 사용합니다."
                  eyebrow="프로필 편집"
                  title="표시 이름과 프로필 사진"
                  titleOrder={3}
                />
                {feedback && (
                  <FeedbackMessage tone={feedback.tone}>
                    {feedback.message}
                  </FeedbackMessage>
                )}
                <Group align="flex-end" grow>
                  <TextInput
                    label="표시 이름"
                    placeholder="표시 이름"
                    value={nickname}
                    onChange={(event) => setNickname(event.currentTarget.value)}
                  />
                  <TextInput
                    label="프로필 사진 URL"
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
                    프로필 변경 저장
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
