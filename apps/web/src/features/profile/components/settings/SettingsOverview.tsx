import { Group, Stack, Text } from '@mantine/core';
import type {
  AuthRefreshSessionResponse,
  AuthUserResponse,
} from '@work-archive/shared-types';

import {
  AppBadge,
  SectionCard,
  SectionIntro,
} from '../../../../shared/components/AppPrimitives';
import type { ImportProviderStatus } from '../../../imports/services/imports.service';
import type { LocalArchiveImportPreview } from '../../../archive/services/local-archive.service';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles as Record<string, string>;
type SummaryIconName = 'data' | 'google' | 'key' | 'security';

interface SettingsOverviewProps {
  archiveFeedback: SettingsFeedback | null;
  archiveImportPreview: LocalArchiveImportPreview | null;
  isLoadingProviderStatuses: boolean;
  isLoadingSessions: boolean;
  mode: SettingsAuthMode;
  providerStatuses: ImportProviderStatus[];
  sessions: AuthRefreshSessionResponse[];
  user: AuthUserResponse | null;
}

function MiniIcon({ name }: { name: SummaryIconName }) {
  const iconProps = {
    'aria-hidden': true,
    fill: 'none',
    height: 18,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    width: 18,
  } as const;

  return (
    <span className={css.summaryIcon ?? ''}>
      {name === 'google' && (
        <svg {...iconProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </svg>
      )}
      {name === 'data' && (
        <svg {...iconProps}>
          <path d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z" />
          <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
          <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      )}
      {name === 'key' && (
        <svg {...iconProps}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8" />
          <path d="m15 8 2 2" />
          <path d="m17 6 2 2" />
        </svg>
      )}
      {name === 'security' && (
        <svg {...iconProps}>
          <path d="M12 3 5 6v6c0 4.4 2.9 7.3 7 9 4.1-1.7 7-4.6 7-9V6l-7-3Z" />
          <path d="m9.5 12 1.7 1.7 3.4-3.7" />
        </svg>
      )}
    </span>
  );
}

export function SettingsOverview({
  archiveFeedback,
  archiveImportPreview,
  isLoadingProviderStatuses,
  isLoadingSessions,
  mode,
  providerStatuses,
  sessions,
  user,
}: SettingsOverviewProps) {
  const googleAccount = user?.authAccounts?.find(
    (account) => account.provider === 'google',
  );
  const publicProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'none',
  ).length;
  const keyRequiredProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'user',
  ).length;
  const configuredProviderCount = providerStatuses.filter(
    (status) => status.configured,
  ).length;
  const activeSessionCount = sessions.length;

  const cards = [
    {
      description:
        mode === 'authenticated'
          ? googleAccount?.email ?? user?.email ?? 'Google 계정으로 연결됨'
          : '게스트 모드에서 로컬 기록만 사용 중',
      icon: 'google',
      label: 'Google 계정 상태',
      tone: mode === 'authenticated' ? 'success' : 'muted',
      value: mode === 'authenticated' ? '연결됨' : '미연결',
    },
    {
      description: archiveImportPreview
        ? '가져오기 미리보기 확인 대기'
        : archiveFeedback?.tone === 'success'
          ? archiveFeedback.message
          : 'API key 없이 JSON/CSV 백업 가능',
      icon: 'data',
      label: '로컬 데이터/백업 상태',
      tone: archiveImportPreview ? 'warning' : 'success',
      value: archiveImportPreview ? '검토 필요' : '준비됨',
    },
    {
      description: isLoadingProviderStatuses
        ? '검색 provider 상태를 확인 중'
        : `공개 ${publicProviderCount}개 · 키 필요 ${keyRequiredProviderCount}개`,
      icon: 'key',
      label: '검색 provider/API key 상태',
      tone: configuredProviderCount > 0 ? 'success' : 'muted',
      value: `${configuredProviderCount}개 등록`,
    },
    {
      description: isLoadingSessions
        ? '활성 세션을 확인 중'
        : mode === 'authenticated'
          ? `활성 세션 ${activeSessionCount}개`
          : '로그인 후 세션 관리 가능',
      icon: 'security',
      label: '보안/활성 세션 상태',
      tone: mode === 'authenticated' ? 'success' : 'muted',
      value: mode === 'authenticated' ? '관리 가능' : '게스트',
    },
  ] as const;

  return (
    <Stack gap="md">
      <SectionIntro
        description="계정 연결, 로컬 백업, 외부 검색 키, 로그인 세션을 한 화면에서 점검합니다."
        eyebrow="Settings Control Center"
        title="설정 개요"
      />
      <div className={css.overviewGrid ?? ''}>
        {cards.map((card) => (
          <SectionCard
            className={css.summaryCard ?? ''}
            gap="sm"
            key={card.label}
            padding="lg"
            tone="subtle"
          >
            <Group justify="space-between" wrap="nowrap">
              <MiniIcon name={card.icon} />
              <AppBadge tone={card.tone}>{card.value}</AppBadge>
            </Group>
            <Stack gap={4}>
              <Text fw={800}>{card.label}</Text>
              <Text c="dimmed" size="sm">
                {card.description}
              </Text>
            </Stack>
          </SectionCard>
        ))}
      </div>
    </Stack>
  );
}
