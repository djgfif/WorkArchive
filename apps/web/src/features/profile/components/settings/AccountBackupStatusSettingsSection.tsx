import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
} from '@app/i18n';
import { syncService, type SyncDashboardItem } from '@features/sync';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import {
  buildRecoveryGroups,
  getAccountBackupStatusTone,
  getItemRecoveryGroup,
  getMergeGroups,
  type MergeGroupKey,
  type RecoveryFilterKey,
} from '../../utils/account-backup-status';
import styles from './SettingsControlCenter.module.css';

const css = styles;

interface AccountBackupStatusSettingsSectionProps {
  conflictItems: SyncDashboardItem[];
  failedItems: SyncDashboardItem[];
  lastSuccessfulPullAt: string | null;
  mode: 'authenticated' | 'guest';
  pendingItems: SyncDashboardItem[];
  staleStatusAt: string | null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AccountBackupStatusSettingsSection({
  conflictItems,
  failedItems,
  lastSuccessfulPullAt,
  mode,
  pendingItems,
  staleStatusAt,
}: AccountBackupStatusSettingsSectionProps) {
  const { t } = useAppTranslation();
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [selectedMergeGroups, setSelectedMergeGroups] = useState<
    Record<string, MergeGroupKey[]>
  >({});
  const [recoveryFilter, setRecoveryFilter] =
    useState<RecoveryFilterKey>('all');
  const requeuedCount = pendingItems.filter(
    (item) => item.state === 'requeued',
  ).length;
  const statusTone = getAccountBackupStatusTone({
    conflictCount: conflictItems.length,
    failedCount: failedItems.length,
    pendingCount: pendingItems.length,
    staleStatusAt,
  });
  const statusLabel =
    statusTone === 'warning'
      ? t('settings.dataSafety.accountStatusNeedsReview')
      : statusTone === 'info'
        ? t('settings.dataSafety.accountStatusPending')
        : t('settings.dataSafety.accountStatusSafe');
  const visibleConflictItems = useMemo(
    () => conflictItems.slice(0, 5),
    [conflictItems],
  );
  const recoveryGroups = useMemo(
    () =>
      buildRecoveryGroups({
        conflictItems,
        failedItems,
        staleStatusAt,
      }),
    [conflictItems, failedItems, staleStatusAt],
  );
  const recoveryQueueItems = useMemo(
    () =>
      [...conflictItems, ...failedItems]
        .filter((item) =>
          recoveryFilter === 'all'
            ? true
            : getItemRecoveryGroup(item) === recoveryFilter,
        )
        .slice(0, 8),
    [conflictItems, failedItems, recoveryFilter],
  );

  async function runResolution(
    itemId: string,
    resolve: () => Promise<unknown>,
    successMessage: string,
  ) {
    try {
      setFeedback(null);
      setResolvingItemId(itemId);
      await resolve();
      setFeedback({ tone: 'success', message: successMessage });
    } catch {
      setFeedback({
        tone: 'error',
        message: t('settings.dataSafety.resolveError'),
      });
    } finally {
      setResolvingItemId(null);
    }
  }

  if (mode !== 'authenticated') {
    return (
      <SectionCard>
        <SectionIntro
          description={t('settings.dataSafety.accountGuestDescription')}
          eyebrow={t('settings.dataSafety.accountEyebrow')}
          title={t('settings.dataSafety.accountTitle')}
        />
        <ActionRow>
          <AppBadge tone="muted">
            {t('settings.dataSafety.accountBackupOptional')}
          </AppBadge>
          <AppLinkButton to="/auth/login" tone="secondary">
            {t('settings.dataSafety.accountLoginAction')}
          </AppLinkButton>
        </ActionRow>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <Group align="flex-start" justify="space-between" wrap="wrap">
        <SectionIntro
          description={t('settings.dataSafety.accountDescription')}
          eyebrow={t('settings.dataSafety.accountEyebrow')}
          title={t('settings.dataSafety.accountTitle')}
        />
        <AppBadge tone={statusTone}>{statusLabel}</AppBadge>
      </Group>

      {(conflictItems.length > 0 || failedItems.length > 0) && (
        <ActionRow>
          <AppBadge tone="warning">
            {t('settings.dataSafety.actionReviewAccountBackup')}
          </AppBadge>
        </ActionRow>
      )}

      <KeyValueGrid
        columns={2}
        items={[
          {
            label: t('settings.dataSafety.accountPending'),
            value: t('settings.dataSafety.accountPendingValue', {
              count: formatAppNumber(pendingItems.length),
            }),
          },
          {
            label: t('settings.dataSafety.accountNeedsReview'),
            value: t('settings.dataSafety.accountNeedsReviewValue', {
              count: formatAppNumber(conflictItems.length + failedItems.length),
            }),
          },
          {
            label: t('settings.dataSafety.accountAutoMerged'),
            value: t('settings.dataSafety.accountAutoMergedValue', {
              count: formatAppNumber(requeuedCount),
            }),
          },
          {
            label: t('settings.dataSafety.accountLastChecked'),
            value: staleStatusAt
              ? t('settings.dataSafety.accountLastCheckedStale')
              : formatDateTime(lastSuccessfulPullAt),
          },
        ]}
      />

      {recoveryGroups.length > 0 && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.dataSafety.recoveryDescription')}
            eyebrow={t('settings.dataSafety.recoveryEyebrow')}
            title={t('settings.dataSafety.recoveryTitle')}
            titleOrder={3}
          />
          <Stack className={css.recoveryList ?? ''} gap="sm">
            <ActionRow>
              <AppButton
                aria-pressed={recoveryFilter === 'all'}
                onClick={() => setRecoveryFilter('all')}
                size="compact-sm"
                tone={recoveryFilter === 'all' ? 'secondary' : 'quiet'}
                type="button"
              >
                {t('settings.dataSafety.recoveryFilterAll')}
              </AppButton>
              {recoveryGroups.map((group) => (
                <AppButton
                  aria-pressed={recoveryFilter === group.key}
                  key={group.key}
                  onClick={() => setRecoveryFilter(group.key)}
                  size="compact-sm"
                  tone={recoveryFilter === group.key ? 'secondary' : 'quiet'}
                  type="button"
                >
                  {t(`settings.dataSafety.recoveryGroups.${group.key}.title`)}
                </AppButton>
              ))}
            </ActionRow>
            {recoveryGroups.map((group) => (
              <div className={css.recoveryItem ?? ''} key={group.key}>
                <Group align="flex-start" gap="sm" wrap="nowrap">
                  <AppBadge tone={group.tone}>
                    {t('settings.dataSafety.recoveryCount', {
                      count: formatAppNumber(group.count),
                    })}
                  </AppBadge>
                  <Stack gap={3} miw={0}>
                    <Text fw={850} size="sm">
                      {t(
                        `settings.dataSafety.recoveryGroups.${group.key}.title`,
                      )}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {t(
                        `settings.dataSafety.recoveryGroups.${group.key}.description`,
                      )}
                    </Text>
                    <Text fw={700} size="sm">
                      {t(
                        `settings.dataSafety.recoveryGroups.${group.key}.action`,
                      )}
                    </Text>
                  </Stack>
                </Group>
              </div>
            ))}
            {recoveryQueueItems.length > 0 && (
              <div className={css.recoveryItem ?? ''}>
                <Stack gap="xs">
                  <Text fw={850} size="sm">
                    {t('settings.dataSafety.recoveryFilteredItemsTitle')}
                  </Text>
                  {recoveryQueueItems.map((item) => (
                    <Group
                      align="center"
                      gap="sm"
                      justify="space-between"
                      key={item.id}
                      wrap="wrap"
                    >
                      <Stack gap={2} miw={0}>
                        <Text fw={700} size="sm">
                          {item.title}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {t('settings.dataSafety.recoveryItemMeta', {
                            operation: t(
                              `settings.dataSafety.recoveryOperations.${item.operation}`,
                            ),
                            retryCount: formatAppNumber(item.retryCount),
                          })}
                        </Text>
                      </Stack>
                      <AppBadge
                        tone={item.state === 'conflict' ? 'warning' : 'muted'}
                      >
                        {t(
                          `settings.dataSafety.recoveryGroups.${getItemRecoveryGroup(
                            item,
                          )}.title`,
                        )}
                      </AppBadge>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </SectionCard>
      )}

      {failedItems.length > 0 && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.dataSafety.failedDescription')}
            eyebrow={t('settings.dataSafety.failedEyebrow')}
            title={t('settings.dataSafety.failedTitle', {
              count: formatAppNumber(failedItems.length),
            })}
            titleOrder={3}
          />
          <Stack gap="xs">
            {failedItems.slice(0, 5).map((item) => (
              <Text key={item.id} size="sm">
                {item.title} ·{' '}
                {t(
                  `settings.dataSafety.recoveryGroups.${getItemRecoveryGroup(
                    item,
                  )}.title`,
                )}
              </Text>
            ))}
          </Stack>
        </SectionCard>
      )}

      {visibleConflictItems.length > 0 && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.dataSafety.conflictDescription')}
            eyebrow={t('settings.dataSafety.conflictEyebrow')}
            title={t('settings.dataSafety.conflictTitle', {
              count: formatAppNumber(conflictItems.length),
            })}
            titleOrder={3}
          />
          <Stack gap="md" className={css.syncConflictList ?? ''}>
            {visibleConflictItems.map((item) => {
              const mergeGroups = getMergeGroups(item);
              const selectedValues = selectedMergeGroups[item.id] ?? [];
              const selectedKeys = new Set(selectedValues);
              const selectedFields = mergeGroups
                .filter((group) => selectedKeys.has(group.key))
                .flatMap((group) => group.fields);
              const canApplyRemote = Boolean(item.conflictRemote);
              const canMergeSelected =
                canApplyRemote && selectedFields.length > 0;

              return (
                <SectionCard key={item.id} padding="md" tone="default">
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="wrap">
                      <Stack gap={3}>
                        <Text fw={850}>{item.title}</Text>
                        <Text c="dimmed" size="sm">
                          {item.conflictMessage ??
                            t('settings.dataSafety.conflictMessageFallback')}
                        </Text>
                      </Stack>
                      <AppBadge tone="warning">
                        {t('settings.dataSafety.conflictBadge')}
                      </AppBadge>
                    </Group>

                    {mergeGroups.length > 0 && (
                      <Checkbox.Group
                        label={t('settings.dataSafety.mergeFieldLabel')}
                        onChange={(values) =>
                          setSelectedMergeGroups((current) => ({
                            ...current,
                            [item.id]: values as MergeGroupKey[],
                          }))
                        }
                        value={selectedValues}
                      >
                        <div className={css.mergeFieldGrid ?? ''}>
                          {mergeGroups.map((group) => (
                            <Checkbox
                              key={group.key}
                              label={t(
                                `settings.dataSafety.mergeFields.${group.key}`,
                              )}
                              value={group.key}
                            />
                          ))}
                        </div>
                      </Checkbox.Group>
                    )}

                    <ActionRow>
                      <AppButton
                        disabled={resolvingItemId !== null}
                        loading={resolvingItemId === item.id}
                        onClick={() =>
                          void runResolution(
                            item.id,
                            () => syncService.resolveConflictWithLocal(item.id),
                            t('settings.dataSafety.resolveLocalSuccess'),
                          )
                        }
                        tone="secondary"
                        type="button"
                      >
                        {t('settings.dataSafety.keepLocalAction')}
                      </AppButton>
                      <AppButton
                        disabled={resolvingItemId !== null || !canApplyRemote}
                        loading={resolvingItemId === item.id}
                        onClick={() =>
                          void runResolution(
                            item.id,
                            () =>
                              syncService.resolveConflictWithRemote(item.id),
                            t('settings.dataSafety.resolveRemoteSuccess'),
                          )
                        }
                        tone="quiet"
                        type="button"
                      >
                        {t('settings.dataSafety.applyRemoteAction')}
                      </AppButton>
                      <AppButton
                        disabled={resolvingItemId !== null || !canMergeSelected}
                        loading={resolvingItemId === item.id}
                        onClick={() =>
                          void runResolution(
                            item.id,
                            () =>
                              syncService.resolveConflictWithMergedFields(
                                item.id,
                                selectedFields,
                              ),
                            t('settings.dataSafety.resolveMergeSuccess'),
                          )
                        }
                        tone="quiet"
                        type="button"
                      >
                        {t('settings.dataSafety.mergeSelectedAction')}
                      </AppButton>
                    </ActionRow>
                  </Stack>
                </SectionCard>
              );
            })}
          </Stack>
        </SectionCard>
      )}

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          {feedback.message}
        </FeedbackMessage>
      )}
    </SectionCard>
  );
}
