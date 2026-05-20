import { Group, Image, Stack, Text, TextInput } from '@mantine/core';
import type { AuthUserResponse } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  SectionCard,
  SectionIntro,
} from '../../../../shared/components/AppPrimitives';

type SettingsAuthMode = 'authenticated' | 'guest';

interface AccountSettingsSectionProps {
  mode: SettingsAuthMode;
  user: AuthUserResponse | null;
}

export function AccountSettingsSection({
  mode,
  user,
}: AccountSettingsSectionProps) {
  const googleAccount = user?.authAccounts?.find(
    (account) => account.provider === 'google',
  );
  const displayName =
    googleAccount?.name || user?.nickname || user?.email || '게스트';
  const handle = user?.handle ?? '';
  const email = googleAccount?.email ?? user?.email ?? '로그인되지 않음';

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
            {googleAccount?.pictureUrl && (
              <Image
                alt=""
                h={56}
                radius="xl"
                src={googleAccount.pictureUrl}
                w={56}
              />
            )}
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
            <Stack gap="md">
              <SectionIntro
                description="표시 이름과 handle 저장 API가 아직 연결되지 않았습니다. 현재 값은 계정 정보에서 읽어온 미리보기입니다."
                eyebrow="편집 준비 중"
                title="표시 이름과 handle"
                titleOrder={3}
              />
              <Group align="flex-end" grow>
                <TextInput
                  label="표시 이름"
                  placeholder="표시 이름"
                  readOnly
                  value={displayName}
                />
                <TextInput
                  label="@handle"
                  leftSection="@"
                  placeholder="handle"
                  readOnly
                  value={handle}
                />
              </Group>
              <ActionRow>
                <AppBadge tone="muted">프로필 편집 API 연결 대기</AppBadge>
                <AppBadge tone="muted">현재 화면에서는 수정 불가</AppBadge>
              </ActionRow>
            </Stack>
          </SectionCard>
        </Stack>
      )}
    </SectionCard>
  );
}
