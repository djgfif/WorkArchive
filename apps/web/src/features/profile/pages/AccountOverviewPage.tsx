import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { useLocation } from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { AccountPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { useArchiveSafetyState } from '@features/sync';
import { useWorksOverview } from '@features/works';
import styles from './AccountOverviewPage.module.css';
import { cn, cx } from '@shared/utils/class-names';

const css = styles;

function formatAverageRating(value: number | null, fallback: string) {
  return value === null ? fallback : `★ ${value.toFixed(1)}`;
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
  const { t } = useAppTranslation();
  usePageTitle(t('accountOverview.pageTitle'));
  const location = useLocation();
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const archiveSafety = useArchiveSafetyState();
  const safetyState = archiveSafety.state;
  const safetyPresentation = archiveSafety.presentation;
  const isAuthenticated = mode === 'authenticated';
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;
  const accountLabel = isAuthenticated
    ? (user?.email ?? t('accountOverview.connectedAccount'))
    : t('accountOverview.guestMode');
  const backupStatus = {
    badge: safetyPresentation.title,
    description: safetyPresentation.description,
    tone: safetyPresentation.tone,
    value: safetyPresentation.syncLabel,
  };

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton to="/profile">
          {t('accountOverview.summaryAction')}
        </AppLinkButton>
      }
      description={
        isAuthenticated
          ? t('accountOverview.descriptionAuthenticated')
          : t('accountOverview.descriptionGuest')
      }
      eyebrow={t('accountOverview.eyebrow')}
      title={
        isAuthenticated
          ? t('accountOverview.titleAuthenticated')
          : t('accountOverview.titleGuest')
      }
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
                    {isAuthenticated
                      ? t('accountOverview.connectedAccount')
                      : t('accountOverview.localAccount')}
                  </Text>
                  <Title className={cn(css.heroTitle)} order={2}>
                    {accountLabel}
                  </Title>
                </Stack>
              </Group>
              <Text className={cn(css.heroDescription)}>
                {isAuthenticated
                  ? t('accountOverview.workBackupDescriptionAuthenticated')
                  : t('accountOverview.workBackupDescriptionGuest')}
              </Text>
              <Group gap="xs" wrap="wrap">
                <AppBadge tone="muted">
                  {isAuthenticated
                    ? t('navigation.signedIn')
                    : t('accountOverview.guest')}
                </AppBadge>
                <AppBadge tone={backupStatus.tone}>
                  {backupStatus.badge}
                </AppBadge>
              </Group>
            </Stack>

            <Box
              className={cn(css.metricStrip)}
              aria-label={t('accountOverview.metricsLabel')}
            >
              <OverviewMetric
                label={t('accountOverview.metricsTotalWorks')}
                value={totalCount}
              />
              <OverviewMetric
                label={t('accountOverview.metricsCompleted')}
                value={completedCount}
              />
              <OverviewMetric
                label={t('accountOverview.metricsAverageRating')}
                value={formatAverageRating(
                  averageRating,
                  t('accountOverview.noRating'),
                )}
              />
            </Box>
          </Group>
        </Box>

        <div className={cn(css.managementGrid)}>
          <SectionCard className={cn(css.statusPanel)}>
            <SectionIntro
              description={t('accountOverview.currentStatusDescription')}
              eyebrow={t('accountOverview.status')}
              title={t('accountOverview.currentStatusTitle')}
              titleOrder={3}
            />

            <Stack gap="lg">
              <Box className={cn(css.statusGroup)}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className={cn(css.statusGroupTitle)}>
                    {t('accountOverview.statusAccount')}
                  </Text>
                  <AppBadge tone="muted">
                    {isAuthenticated
                      ? t('accountOverview.statusActive')
                      : t('accountOverview.guest')}
                  </AppBadge>
                </Group>
                <StatusLine
                  label={t('accountOverview.statusConnection')}
                  tone="default"
                  value={
                    isAuthenticated
                      ? t('navigation.signedIn')
                      : t('accountOverview.localOnly')
                  }
                />
                <StatusLine
                  label={t('accountOverview.statusStorageLocation')}
                  tone="default"
                  value={
                    isAuthenticated
                      ? t('accountOverview.localPlusAccount')
                      : t('accountOverview.deviceOnly')
                  }
                />
              </Box>

              <Box className={cn(css.statusGroup)}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className={cn(css.statusGroupTitle)}>
                    {t('accountOverview.backup')}
                  </Text>
                  <AppBadge tone={backupStatus.tone}>
                    {backupStatus.badge}
                  </AppBadge>
                </Group>
                <Text className={cn(css.statusDescription)}>
                  {backupStatus.description}
                </Text>
                <StatusLine
                  label={t('accountOverview.backupStatus')}
                  tone={backupStatus.tone === 'warning' ? 'warning' : 'default'}
                  value={backupStatus.value}
                />
                <StatusLine
                  label={t('settings.dataSafety.lastJsonBackupLabel')}
                  tone={
                    safetyState.jsonBackup.status === 'missing' ||
                    safetyState.jsonBackup.status === 'stale'
                      ? 'warning'
                      : 'default'
                  }
                  value={safetyPresentation.jsonBackupLabel}
                />
                <StatusLine
                  label={t('settings.dataSafety.lastSuccessfulPushLabel')}
                  tone="default"
                  value={safetyPresentation.lastPushLabel}
                />
                <StatusLine
                  label={t('settings.dataSafety.lastSuccessfulPullLabel')}
                  tone="default"
                  value={safetyPresentation.lastPullLabel}
                />
                <StatusLine
                  label={t('accountOverview.offlineRecording')}
                  tone="default"
                  value={t('accountOverview.offlineRecordingAvailable')}
                />
              </Box>
            </Stack>
          </SectionCard>

          <SectionCard className={cn(css.workPanel)} tone="subtle">
            <SectionIntro
              description={t('accountOverview.quickActionsDescription')}
              eyebrow={t('accountOverview.quickActionsEyebrow')}
              title={t('accountOverview.quickActionsTitle')}
              titleOrder={3}
            />

            <div className={cn(css.actionList)}>
              {isAuthenticated ? (
                <ActionItem
                  action={t('accountOverview.actionAccountSettings')}
                  description={t('accountOverview.actionAccountDescription')}
                  title={t('accountOverview.actionAccountTitle')}
                  to="/account/settings#account"
                />
              ) : (
                <ActionItem
                  action={t('accountOverview.actionLogin')}
                  description={t('accountOverview.actionLoginDescription')}
                  state={{ returnTo: loginReturnTo }}
                  title={t('accountOverview.actionLoginTitle')}
                  to="/auth/login"
                  tone="primary"
                />
              )}
              <ActionItem
                action={t('accountOverview.actionBackupSettings')}
                description={t('accountOverview.actionBackupDescription')}
                title={t('settings.sections.dataBackup')}
                to="/account/settings#data-backup"
              />
              <ActionItem
                action={t('accountOverview.actionOpenSettings')}
                description={t('accountOverview.actionEnvironmentDescription')}
                title={t('accountOverview.actionEnvironmentTitle')}
                to="/account/settings"
              />
              <ActionItem
                action={t('accountOverview.actionProfileView')}
                description={t('accountOverview.actionProfileDescription')}
                title={t('accountOverview.actionProfileTitle')}
                to="/profile"
              />
            </div>
          </SectionCard>
        </div>
      </Stack>
    </AccountPageTemplate>
  );
}
