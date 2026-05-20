import { Stack, Text } from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  SectionCard,
  SectionIntro,
} from '../../../../shared/components/AppPrimitives';
import { confirmDialogAdapter } from '../../../../shared/runtime/dialog-adapter';
import styles from './SettingsControlCenter.module.css';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles as Record<string, string>;

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
  async function handleRevokeAllSessions() {
    const shouldRevoke = await confirmDialogAdapter.confirm({
      title: '모든 기기에서 로그아웃할까요?',
      description:
        '현재 기기를 포함한 모든 로그인 세션이 해제되고 이 브라우저도 즉시 게스트 모드로 전환됩니다.',
    });

    if (!shouldRevoke) {
      return;
    }

    onRevokeAllSessions();
  }

  return (
    <SectionCard className={css.dangerCard ?? ''}>
      <SectionIntro
        description="계정 접근 상태에 영향을 주는 작업입니다. 로컬 백업 파일에는 API key와 로그인 세션이 포함되지 않습니다."
        eyebrow="위험 작업"
        title="Danger area"
      />

      <SectionCard padding="lg" tone="subtle">
        <Stack gap="sm">
          <ActionRow>
            <Text fw={800}>모든 기기 로그아웃</Text>
            <AppBadge tone={mode === 'authenticated' ? 'danger' : 'muted'}>
              {mode === 'authenticated'
                ? `활성 세션 ${sessionCount}개`
                : '로그인 필요'}
            </AppBadge>
          </ActionRow>
          <Text c="dimmed" size="sm">
            현재 기기를 포함한 모든 refresh session을 해제하고 이 브라우저도
            즉시 게스트 모드로 전환합니다.
          </Text>
          <ActionRow>
            <AppButton
              disabled={mode !== 'authenticated'}
              loading={revokingSessionId === 'all'}
              onClick={() => void handleRevokeAllSessions()}
              tone="danger"
              type="button"
            >
              모든 기기 로그아웃
            </AppButton>
          </ActionRow>
        </Stack>
      </SectionCard>
    </SectionCard>
  );
}
