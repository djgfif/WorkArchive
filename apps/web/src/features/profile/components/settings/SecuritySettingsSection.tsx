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

function formatSessionDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatUserAgent(value: string | null) {
  if (!value) {
    return '정보 없음';
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
          : '브라우저';
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
    return '정보 없음';
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
  const hasSessions = sessions.length > 0;

  return (
    <SectionCard>
      <SectionIntro
        description="현재 로그인 방식과 활성 세션을 확인합니다. Work Archive는 이메일/비밀번호 로그인 없이 Google 계정 연결만 사용합니다."
        eyebrow="보안"
        title="로그인과 세션"
      />

      <SectionCard padding="lg" tone="subtle">
        <SectionIntro
          description={
            mode === 'authenticated'
              ? 'Google OAuth 기반으로 로그인되어 있습니다.'
              : '현재 게스트 모드입니다. 로컬 기록은 이 브라우저에 먼저 저장됩니다.'
          }
          eyebrow="현재 로그인 방식"
          title={mode === 'authenticated' ? 'Google 계정' : '게스트 모드'}
          titleOrder={3}
        />
        <ActionRow>
          <AppBadge tone={mode === 'authenticated' ? 'success' : 'muted'}>
            {mode === 'authenticated'
              ? 'Google-only auth'
              : 'Local-first guest'}
          </AppBadge>
          <AppBadge tone="muted">이메일/비밀번호 로그인 없음</AppBadge>
        </ActionRow>
      </SectionCard>

      {mode !== 'authenticated' ? (
        <Text c="dimmed">
          로그인하면 계정 세션을 확인하고 더 이상 사용하지 않는 기기의 로그인
          상태를 해제할 수 있습니다.
        </Text>
      ) : isLoadingSessions ? (
        <Text aria-busy="true" c="dimmed">
          세션 목록을 불러오는 중입니다.
        </Text>
      ) : !hasSessions ? (
        <Text c="dimmed">현재 확인된 활성 세션이 없습니다.</Text>
      ) : (
        <Stack gap="sm">
          <ActionRow>
            <AppBadge tone="success">활성 세션 {sessions.length}개</AppBadge>
            <AppBadge tone="accent">
              로그인 유지{' '}
              {sessions.filter((session) => session.rememberMe).length}개
            </AppBadge>
            <AppBadge tone="muted">
              현재 기기 {sessions.filter((session) => session.current).length}개
            </AppBadge>
          </ActionRow>

          {sessions.map((session) => (
            <SectionCard key={session.id} padding="md" tone="subtle">
              <Stack gap="xs">
                <ActionRow>
                  <Text fw={800}>
                    {session.current ? '현재 기기' : '다른 기기'}
                  </Text>
                  <AppBadge tone={session.current ? 'success' : 'muted'}>
                    {session.current ? '이 기기' : '활성'}
                  </AppBadge>
                  <AppBadge tone={session.rememberMe ? 'accent' : 'muted'}>
                    {session.rememberMe ? '로그인 유지' : '브라우저 세션'}
                  </AppBadge>
                </ActionRow>

                <Text c="dimmed" size="sm">
                  마지막 사용: {formatSessionDate(session.lastUsedAt)} | 생성:{' '}
                  {formatSessionDate(session.createdAt)} | 만료:{' '}
                  {formatSessionDate(session.expiresAt)}
                </Text>
                <Text c="dimmed" lineClamp={1} size="sm">
                  기기: {formatUserAgent(session.userAgent)} · IP:{' '}
                  {maskIpAddress(session.ipAddress)}
                </Text>

                <ActionRow>
                  <AppButton
                    loading={revokingSessionId === session.id}
                    onClick={() => onRevokeSession(session)}
                    tone={session.current ? 'danger' : 'secondary'}
                    type="button"
                  >
                    {session.current ? '이 기기 로그아웃' : '세션 해제'}
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
              다시 불러오기
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
