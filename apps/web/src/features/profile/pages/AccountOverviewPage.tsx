import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { useLocation } from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { AccountPageTemplate } from '@shared/components/PageTemplates';
import { useAuthSession } from '@features/auth';
import { useSyncDashboard } from '@features/sync';
import { useWorksOverview } from '@features/works';
import styles from './AccountOverviewPage.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatAverageRating(value: number | null) {
  return value === null ? '없음' : `${value.toFixed(1)}점`;
}

function formatRelativeBackupTime(value: string | null) {
  if (!value) {
    return '아직 없음';
  }

  const backupTime = new Date(value).getTime();
  if (Number.isNaN(backupTime)) {
    return '확인 필요';
  }

  const diffMs = Date.now() - backupTime;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}일 전`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}개월 전`;

  return `${Math.floor(diffMonths / 12)}년 전`;
}

interface OverviewMetricProps {
  label: string;
  value: string | number;
}

function OverviewMetric({ label, value }: OverviewMetricProps) {
  return (
    <Box className={cn(css.metricItem)}>
      <Text className={cn(css.metricValue)}>{value}</Text>
      <Text className={cn(css.metricLabel)}>{label}</Text>
    </Box>
  );
}

interface StatusLineProps {
  label: string;
  tone: 'default' | 'success' | 'warning';
  value: string;
}

function StatusLine({ label, tone, value }: StatusLineProps) {
  return (
    <Group
      className={cn(css.statusLine)}
      gap="sm"
      justify="space-between"
      wrap="nowrap"
    >
      <Group gap="xs" miw={0} wrap="nowrap">
        <span className={cx(css.statusDot, css[`statusDot_${tone}`])} />
        <Text className={cn(css.statusLabel)}>{label}</Text>
      </Group>
      <Text className={cn(css.statusValue)}>{value}</Text>
    </Group>
  );
}

interface ActionItemProps {
  action: string;
  description: string;
  state?: unknown;
  title: string;
  to: string;
  tone?: 'primary' | 'secondary';
}

function ActionItem({
  action,
  description,
  state,
  title,
  to,
  tone = 'secondary',
}: ActionItemProps) {
  return (
    <Box className={cn(css.actionItem)}>
      <Stack gap={3} miw={0}>
        <Text className={cn(css.actionTitle)}>{title}</Text>
        <Text className={cn(css.actionDescription)}>{description}</Text>
      </Stack>
      <AppLinkButton state={state} to={to} tone={tone}>
        {action}
      </AppLinkButton>
    </Box>
  );
}

export function AccountOverviewPage() {
  const location = useLocation();
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictItems, failedItems, lastSuccessfulPullAt, pendingItems } =
    useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;
  const backupAttentionCount = conflictItems.length + failedItems.length;
  const backupRequeuedCount = pendingItems.filter(
    (item) => item.state === 'requeued',
  ).length;
  const backupPendingCount = pendingItems.length;
  const accountLabel = isAuthenticated
    ? (user?.email ?? '연결된 계정')
    : '게스트 모드';
  const backupStatus =
    backupAttentionCount > 0
      ? {
          badge: '직접 확인 필요',
          description:
            '자동 병합하기 위험한 백업 항목은 로컬 기록을 유지한 채 직접 확인을 기다립니다.',
          tone: 'warning' as const,
          value: '수동 확인',
        }
      : backupRequeuedCount > 0
        ? {
            badge: '자동 병합됨',
            description:
              '안전한 변경만 자동 병합했고, 새 백업 요청으로 다시 보내는 중입니다.',
            tone: 'info' as const,
            value: '재시도 대기',
          }
        : backupPendingCount > 0
          ? {
              badge: '대기 중',
              description:
                '최근 변경 사항을 동기화하는 중입니다. 오프라인에서도 기록은 유지됩니다.',
              tone: 'info' as const,
              value: '백업 대기',
            }
          : {
              badge: '정상',
              description:
                '로컬 기록을 기준으로 안전하게 보관 중입니다. 로그인하면 자동 백업을 사용할 수 있습니다.',
              tone: 'success' as const,
              value: isAuthenticated ? '보호됨' : '로컬 저장',
            };

  return (
    <AccountPageTemplate
      actions={<AppLinkButton to="/profile">기록 요약 보기</AppLinkButton>}
      description={
        isAuthenticated
          ? '계정 상태, 자동 백업, 로컬 백업 설정을 한 곳에서 확인합니다.'
          : '현재 기기에 저장된 개인 기록과 계정 연결 상태를 확인합니다.'
      }
      eyebrow="계정"
      title={isAuthenticated ? '계정 센터' : '개인 기록 센터'}
    >
      <Stack gap="md">
        <Box className={cn(css.accountHero)}>
          <Group
            align="flex-start"
            justify="space-between"
            gap="xl"
            wrap="wrap"
          >
            <Stack gap="md" className={cn(css.heroCopy)}>
              <Group gap="sm" wrap="nowrap">
                <Box className={cn(css.accountMark)} aria-hidden>
                  {isAuthenticated ? 'A' : 'G'}
                </Box>
                <Stack gap={2} miw={0}>
                  <Text className={cn(css.heroEyebrow)}>
                    {isAuthenticated ? '연결된 계정' : '로컬 계정'}
                  </Text>
                  <Title className={cn(css.heroTitle)} order={2}>
                    {accountLabel}
                  </Title>
                </Stack>
              </Group>
              <Text className={cn(css.heroDescription)}>
                {isAuthenticated
                  ? '작품 기록은 이 기기에 먼저 저장되고, 계정 백업으로 이어집니다.'
                  : '로그인 전까지 기록은 이 기기에만 저장됩니다. 필요할 때 계정 연결과 백업을 켤 수 있습니다.'}
              </Text>
              <Group gap="xs" wrap="wrap">
                <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
                  {isAuthenticated ? '로그인됨' : '게스트'}
                </AppBadge>
                <AppBadge tone={backupStatus.tone}>
                  {backupStatus.badge}
                </AppBadge>
              </Group>
            </Stack>

            <Box className={cn(css.metricStrip)} aria-label="기록 지표">
              <OverviewMetric label="기록한 작품" value={totalCount} />
              <OverviewMetric label="완료" value={completedCount} />
              <OverviewMetric
                label="평균 별점"
                value={formatAverageRating(averageRating)}
              />
            </Box>
          </Group>
        </Box>

        <div className={cn(css.managementGrid)}>
          <SectionCard className={cn(css.statusPanel)}>
            <SectionIntro
              description="계정 연결과 백업 상태를 한 곳에서 확인합니다."
              eyebrow="상태"
              title="현재 상태"
              titleOrder={3}
            />

            <Stack gap="lg">
              <Box className={cn(css.statusGroup)}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className={cn(css.statusGroupTitle)}>계정</Text>
                  <AppBadge tone={isAuthenticated ? 'success' : 'muted'}>
                    {isAuthenticated ? '활성' : '게스트'}
                  </AppBadge>
                </Group>
                <StatusLine
                  label="연결 상태"
                  tone={isAuthenticated ? 'success' : 'default'}
                  value={isAuthenticated ? '로그인됨' : '로컬 전용'}
                />
                <StatusLine
                  label="저장 위치"
                  tone="success"
                  value={isAuthenticated ? '로컬 + 계정' : '이 기기'}
                />
              </Box>

              <Box className={cn(css.statusGroup)}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className={cn(css.statusGroupTitle)}>백업</Text>
                  <AppBadge tone={backupStatus.tone}>
                    {backupStatus.badge}
                  </AppBadge>
                </Group>
                <Text className={cn(css.statusDescription)}>
                  {backupStatus.description}
                </Text>
                <StatusLine
                  label="백업 상태"
                  tone={backupStatus.tone === 'warning' ? 'warning' : 'success'}
                  value={backupStatus.value}
                />
                <StatusLine
                  label="최근 백업"
                  tone="default"
                  value={formatRelativeBackupTime(lastSuccessfulPullAt)}
                />
                <StatusLine label="오프라인 기록" tone="success" value="가능" />
              </Box>
            </Stack>
          </SectionCard>

          <SectionCard className={cn(css.workPanel)} tone="subtle">
            <SectionIntro
              description="필요한 작업만 바로 실행할 수 있게 정리했습니다."
              eyebrow="작업"
              title="빠른 작업"
              titleOrder={3}
            />

            <div className={cn(css.actionList)}>
              {isAuthenticated ? (
                <ActionItem
                  action="계정 설정"
                  description="계정 정보와 로그인 상태를 확인합니다."
                  title="계정 관리"
                  to="/account/settings#account"
                />
              ) : (
                <ActionItem
                  action="로그인"
                  description="자동 백업과 세션 관리를 활성화합니다."
                  state={{ returnTo: loginReturnTo }}
                  title="계정 연결"
                  to="/auth/login"
                  tone="primary"
                />
              )}
              <ActionItem
                action="백업 설정"
                description="JSON/CSV 백업과 가져오기를 관리합니다."
                title="데이터와 백업"
                to="/account/settings#data-backup"
              />
              <ActionItem
                action="설정 열기"
                description="테마, 검색 소스, API 키, 보안 설정을 조정합니다."
                title="환경 설정"
                to="/account/settings"
              />
              <ActionItem
                action="요약 보기"
                description="작품 수, 완료 수, 평균 별점과 최근 기록을 봅니다."
                title="기록 요약"
                to="/profile"
              />
            </div>
          </SectionCard>
        </div>
      </Stack>
    </AccountPageTemplate>
  );
}
