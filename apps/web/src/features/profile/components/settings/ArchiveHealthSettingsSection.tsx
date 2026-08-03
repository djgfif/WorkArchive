import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
} from '@app/i18n';
import {
  archiveHealthService,
  archiveHealthReviewSessionService,
  buildArchiveHealthEditUrl,
  createArchiveHealthReviewItems,
  type ArchiveHealthFixHistoryEntry,
  type ArchiveHealthIssue,
  type ArchiveHealthIssueSeverity,
  type ArchiveHealthReport,
  type ArchiveHealthSafeFix,
} from '@features/works';
import styles from './SettingsControlCenter.module.css';

type HealthFilter = 'all' | 'attention' | 'improvement';

interface ArchiveHealthSettingsSectionProps {
  archiveScopeKey: string;
}

interface WorkIssueGroup {
  issues: ArchiveHealthIssue[];
  severity: ArchiveHealthIssueSeverity;
  workId: string;
  workTitle: string;
}

interface ActionFeedback {
  message: string;
  tone: 'error' | 'success';
}

interface ArchiveHealthRouteState {
  archiveHealthReviewCompleted?: number;
  archiveHealthReviewSaved?: boolean;
}

const INITIAL_VISIBLE_GROUPS = 20;
const severityOrder: Record<ArchiveHealthIssueSeverity, number> = {
  attention: 0,
  review: 1,
  improvement: 2,
};

function getSeverityTone(severity: ArchiveHealthIssueSeverity) {
  if (severity === 'attention') {
    return 'danger' as const;
  }

  if (severity === 'review') {
    return 'warning' as const;
  }

  return 'muted' as const;
}

function groupIssuesByWork(issues: ArchiveHealthIssue[]) {
  const groups = new Map<string, WorkIssueGroup>();

  for (const issue of issues) {
    const existing = groups.get(issue.workId);

    if (existing) {
      existing.issues.push(issue);

      if (severityOrder[issue.severity] < severityOrder[existing.severity]) {
        existing.severity = issue.severity;
      }

      continue;
    }

    groups.set(issue.workId, {
      issues: [issue],
      severity: issue.severity,
      workId: issue.workId,
      workTitle: issue.workTitle,
    });
  }

  return [...groups.values()].sort((left, right) => {
    const severityDifference =
      severityOrder[left.severity] - severityOrder[right.severity];

    return severityDifference !== 0
      ? severityDifference
      : left.workTitle.localeCompare(right.workTitle);
  });
}

function getHighestSeverity(issues: ArchiveHealthIssue[]) {
  return issues.reduce<ArchiveHealthIssueSeverity>(
    (highest, issue) =>
      severityOrder[issue.severity] < severityOrder[highest]
        ? issue.severity
        : highest,
    'improvement',
  );
}

interface ArchiveHealthFixHistoryProps {
  entries: ArchiveHealthFixHistoryEntry[];
  onUndo: (entry: ArchiveHealthFixHistoryEntry) => void;
  pendingActionId: string | null;
}

function ArchiveHealthFixHistory({
  entries,
  onUndo,
  pendingActionId,
}: ArchiveHealthFixHistoryProps) {
  const { t } = useAppTranslation();

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.archiveHealthHistoryPanel ?? ''}>
      <Stack gap="md">
        <Group align="flex-start" justify="space-between">
          <Stack gap={3}>
            <Text fw={850}>{t('settings.archiveHealth.history.title')}</Text>
            <Text c="dimmed" size="xs">
              {t('settings.archiveHealth.history.description')}
            </Text>
          </Stack>
          <AppBadge tone="muted">
            {t('settings.archiveHealth.history.count', {
              count: formatAppNumber(Math.min(entries.length, 5)),
            })}
          </AppBadge>
        </Group>

        <Stack gap="xs">
          {entries.slice(0, 5).map((entry) => (
            <div
              className={styles.archiveHealthHistoryItem ?? ''}
              key={entry.id}
            >
              <Stack gap={5}>
                <Text fw={750} size="sm">
                  {t('settings.archiveHealth.history.item', {
                    title: entry.workTitle,
                    unit: t(
                      `settings.archiveHealth.units.${entry.afterProgressUnit}`,
                    ),
                  })}
                </Text>
                <Text c="dimmed" size="xs">
                  {formatAppDateTime(new Date(entry.appliedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>
              </Stack>

              {entry.undoneAt ? (
                <AppBadge tone="muted">
                  {t('settings.archiveHealth.history.undone')}
                </AppBadge>
              ) : (
                <AppButton
                  aria-label={t('settings.archiveHealth.history.undoAria', {
                    title: entry.workTitle,
                  })}
                  disabled={pendingActionId !== null}
                  loading={pendingActionId === entry.id}
                  onClick={() => onUndo(entry)}
                  size="xs"
                  tone="secondary"
                  type="button"
                >
                  {t('settings.archiveHealth.history.undo')}
                </AppButton>
              )}
            </div>
          ))}
        </Stack>
      </Stack>
    </div>
  );
}

export function ArchiveHealthSettingsSection({
  archiveScopeKey,
}: ArchiveHealthSettingsSectionProps) {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ArchiveHealthRouteState | null;
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<ArchiveHealthReport | null>(null);
  const [fixHistory, setFixHistory] = useState<ArchiveHealthFixHistoryEntry[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(
    null,
  );
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [visibleGroupCount, setVisibleGroupCount] = useState(
    INITIAL_VISIBLE_GROUPS,
  );

  const scanArchive = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextReport, nextHistory] = await Promise.all([
        archiveHealthService.scan(),
        archiveHealthService.listFixHistory(),
      ]);
      setReport(nextReport);
      setFixHistory(nextHistory);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : t('settings.archiveHealth.loadError'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void scanArchive();
  }, [archiveScopeKey, scanArchive]);

  useEffect(() => {
    if (
      !routeState?.archiveHealthReviewCompleted &&
      !routeState?.archiveHealthReviewSaved
    ) {
      return;
    }

    setActionFeedback({
      message: routeState.archiveHealthReviewCompleted
        ? t('settings.archiveHealth.reviewComplete', {
            count: formatAppNumber(routeState.archiveHealthReviewCompleted),
          })
        : t('settings.archiveHealth.reviewSaved'),
      tone: 'success',
    });
    navigate(
      `${location.pathname}${location.search}${location.hash}`,
      { replace: true, state: null },
    );
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    routeState?.archiveHealthReviewCompleted,
    routeState?.archiveHealthReviewSaved,
    t,
  ]);

  useEffect(() => {
    setVisibleGroupCount(INITIAL_VISIBLE_GROUPS);
  }, [filter, report]);

  const issueGroups = useMemo(
    () => groupIssuesByWork(report?.issues ?? []),
    [report?.issues],
  );
  const filteredGroups = useMemo(
    () =>
      issueGroups.flatMap((group) => {
        const issues = group.issues.filter((issue) => {
          if (filter === 'attention') {
            return issue.severity !== 'improvement';
          }

          if (filter === 'improvement') {
            return issue.severity === 'improvement';
          }

          return true;
        });

        return issues.length > 0
          ? [
              {
                ...group,
                issues,
                severity: getHighestSeverity(issues),
              },
            ]
          : [];
      }),
    [filter, issueGroups],
  );
  const needsAttentionWorkCount = useMemo(
    () =>
      issueGroups.filter((group) =>
        group.issues.some((issue) => issue.severity !== 'improvement'),
      ).length,
    [issueGroups],
  );
  const improvementWorkCount = useMemo(
    () =>
      issueGroups.filter((group) =>
        group.issues.some((issue) => issue.severity === 'improvement'),
      ).length,
    [issueGroups],
  );
  const reviewItems = useMemo(
    () => createArchiveHealthReviewItems(report?.issues ?? []),
    [report?.issues],
  );
  const visibleGroups = filteredGroups.slice(0, visibleGroupCount);

  const handleStartReview = useCallback(() => {
    const session = archiveHealthReviewSessionService.create(reviewItems);
    const firstItem = session?.items[0];

    if (!session || !firstItem) {
      setActionFeedback({
        message: t('settings.archiveHealth.reviewUnavailable'),
        tone: 'error',
      });
      return;
    }

    navigate(
      buildArchiveHealthEditUrl(firstItem.workId, {
        issueCodes: firstItem.issueCodes,
        reviewSessionId: session.id,
      }),
    );
  }, [navigate, reviewItems, t]);

  const handleApplySafeFix = useCallback(
    async (issue: ArchiveHealthIssue & { safeFix: ArchiveHealthSafeFix }) => {
      setPendingActionId(issue.id);
      setActionFeedback(null);

      try {
        const entry = await archiveHealthService.applySafeFix(
          issue.workId,
          issue.safeFix,
        );

        setActionFeedback({
          message: t('settings.archiveHealth.fixApplied', {
            title: entry.workTitle,
            unit: t(`settings.archiveHealth.units.${entry.afterProgressUnit}`),
          }),
          tone: 'success',
        });
        await scanArchive();
      } catch (fixError) {
        setActionFeedback({
          message:
            fixError instanceof Error
              ? fixError.message
              : t('settings.archiveHealth.fixError'),
          tone: 'error',
        });
      } finally {
        setPendingActionId(null);
      }
    },
    [scanArchive, t],
  );

  const handleUndoSafeFix = useCallback(
    async (entry: ArchiveHealthFixHistoryEntry) => {
      setPendingActionId(entry.id);
      setActionFeedback(null);

      try {
        const undoneEntry = await archiveHealthService.undoSafeFix(entry.id);

        setActionFeedback({
          message: t('settings.archiveHealth.fixUndone', {
            title: undoneEntry.workTitle,
          }),
          tone: 'success',
        });
        await scanArchive();
      } catch (undoError) {
        setActionFeedback({
          message:
            undoError instanceof Error
              ? undoError.message
              : t('settings.archiveHealth.undoError'),
          tone: 'error',
        });
      } finally {
        setPendingActionId(null);
      }
    },
    [scanArchive, t],
  );

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.archiveHealth.description')}
        eyebrow={t('settings.archiveHealth.eyebrow')}
        title={t('settings.archiveHealth.title')}
      />

      <ActionRow justify="space-between">
        <Stack gap={3}>
          <Text fw={800} size="sm">
            {report
              ? t('settings.archiveHealth.scanSummary', {
                  affected: formatAppNumber(report.affectedWorkCount),
                  total: formatAppNumber(report.totalWorkCount),
                })
              : t('settings.archiveHealth.scanPending')}
          </Text>
          {report && (
            <Text c="dimmed" size="xs">
              {t('settings.archiveHealth.scannedAt', {
                date: formatAppDateTime(new Date(report.scannedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </Text>
          )}
        </Stack>
        <AppButton
          disabled={isLoading}
          loading={isLoading}
          onClick={() => void scanArchive()}
          type="button"
        >
          {t('settings.archiveHealth.rescan')}
        </AppButton>
      </ActionRow>

      {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}

      {actionFeedback && (
        <FeedbackMessage tone={actionFeedback.tone}>
          {actionFeedback.message}
        </FeedbackMessage>
      )}

      {report && (
        <>
          <div className={styles.archiveHealthSummaryGrid ?? ''}>
            <div className={styles.archiveHealthSummaryCard ?? ''}>
              <AppBadge
                tone={report.issueCounts.attention > 0 ? 'danger' : 'success'}
              >
                {t('settings.archiveHealth.severity.attention')}
              </AppBadge>
              <Text fw={900} size="xl">
                {formatAppNumber(report.issueCounts.attention)}
              </Text>
              <Text c="dimmed" size="sm">
                {t('settings.archiveHealth.summary.attention')}
              </Text>
            </div>
            <div className={styles.archiveHealthSummaryCard ?? ''}>
              <AppBadge
                tone={report.issueCounts.review > 0 ? 'warning' : 'success'}
              >
                {t('settings.archiveHealth.severity.review')}
              </AppBadge>
              <Text fw={900} size="xl">
                {formatAppNumber(report.issueCounts.review)}
              </Text>
              <Text c="dimmed" size="sm">
                {t('settings.archiveHealth.summary.review')}
              </Text>
            </div>
            <div className={styles.archiveHealthSummaryCard ?? ''}>
              <AppBadge tone="muted">
                {t('settings.archiveHealth.severity.improvement')}
              </AppBadge>
              <Text fw={900} size="xl">
                {formatAppNumber(report.issueCounts.improvement)}
              </Text>
              <Text c="dimmed" size="sm">
                {t('settings.archiveHealth.summary.improvement')}
              </Text>
            </div>
          </div>

          {reviewItems.length > 0 && (
            <ActionRow justify="space-between">
              <Stack gap={3}>
                <Text fw={800} size="sm">
                  {t('settings.archiveHealth.reviewTitle')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t('settings.archiveHealth.reviewDescription', {
                    count: formatAppNumber(reviewItems.length),
                  })}
                </Text>
              </Stack>
              <AppButton
                aria-label={t('settings.archiveHealth.reviewStartAria', {
                  count: formatAppNumber(reviewItems.length),
                })}
                onClick={handleStartReview}
                tone="primary"
                type="button"
              >
                {t('settings.archiveHealth.reviewStart', {
                  count: formatAppNumber(reviewItems.length),
                })}
              </AppButton>
            </ActionRow>
          )}

          {report.issues.length === 0 ? (
            <FeedbackMessage tone="success">
              {t('settings.archiveHealth.healthy')}
            </FeedbackMessage>
          ) : (
            <Stack gap="md">
              <SegmentedControl
                aria-label={t('settings.archiveHealth.filterAria')}
                data={[
                  {
                    label: t('settings.archiveHealth.filters.all', {
                      count: formatAppNumber(report.affectedWorkCount),
                    }),
                    value: 'all',
                  },
                  {
                    label: t('settings.archiveHealth.filters.attention', {
                      count: formatAppNumber(needsAttentionWorkCount),
                    }),
                    value: 'attention',
                  },
                  {
                    label: t('settings.archiveHealth.filters.improvement', {
                      count: formatAppNumber(improvementWorkCount),
                    }),
                    value: 'improvement',
                  },
                ]}
                fullWidth
                onChange={(value) => setFilter(value as HealthFilter)}
                value={filter}
              />

              {visibleGroups.map((group) => (
                <div
                  className={styles.archiveHealthIssueCard ?? ''}
                  key={group.workId}
                >
                  <Stack gap="sm">
                    <Group align="flex-start" justify="space-between">
                      <Stack gap={3}>
                        <Text fw={850}>{group.workTitle}</Text>
                        <Text c="dimmed" size="xs">
                          {t('settings.archiveHealth.issueCount', {
                            count: formatAppNumber(group.issues.length),
                          })}
                        </Text>
                      </Stack>
                      <AppBadge tone={getSeverityTone(group.severity)}>
                        {t(`settings.archiveHealth.severity.${group.severity}`)}
                      </AppBadge>
                    </Group>

                    <div className={styles.archiveHealthIssueList ?? ''}>
                      {group.issues.map((issue) => (
                        <div
                          className={styles.archiveHealthIssue ?? ''}
                          key={issue.id}
                        >
                          <Text fw={750} size="sm">
                            {t(
                              `settings.archiveHealth.issues.${issue.code}.title`,
                            )}
                          </Text>
                          <Text c="dimmed" size="xs">
                            {t(
                              `settings.archiveHealth.issues.${issue.code}.description`,
                              issue.details,
                            )}
                          </Text>
                          {issue.safeFix && (
                            <div
                              className={styles.archiveHealthSafeFixRow ?? ''}
                            >
                              <Text c="dimmed" size="xs">
                                {t(
                                  'settings.archiveHealth.safeFixDescription',
                                  {
                                    unit: t(
                                      `settings.archiveHealth.units.${issue.safeFix.progressUnit}`,
                                    ),
                                  },
                                )}
                              </Text>
                              <AppButton
                                aria-label={t(
                                  'settings.archiveHealth.safeFixAria',
                                  {
                                    title: group.workTitle,
                                  },
                                )}
                                disabled={pendingActionId !== null}
                                loading={pendingActionId === issue.id}
                                onClick={() =>
                                  void handleApplySafeFix(
                                    issue as ArchiveHealthIssue & {
                                      safeFix: ArchiveHealthSafeFix;
                                    },
                                  )
                                }
                                size="xs"
                                tone="secondary"
                                type="button"
                              >
                                {t('settings.archiveHealth.safeFix')}
                              </AppButton>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <ActionRow justify="flex-end">
                      <AppLinkButton
                        to={buildArchiveHealthEditUrl(group.workId, {
                          issueCodes: group.issues.map(
                            (issue) => issue.code,
                          ),
                        })}
                      >
                        {t('settings.archiveHealth.editRecord')}
                      </AppLinkButton>
                    </ActionRow>
                  </Stack>
                </div>
              ))}

              {visibleGroups.length < filteredGroups.length && (
                <ActionRow justify="center">
                  <AppButton
                    onClick={() =>
                      setVisibleGroupCount(
                        (current) => current + INITIAL_VISIBLE_GROUPS,
                      )
                    }
                    tone="secondary"
                    type="button"
                  >
                    {t('settings.archiveHealth.showMore', {
                      count: formatAppNumber(
                        filteredGroups.length - visibleGroups.length,
                      ),
                    })}
                  </AppButton>
                </ActionRow>
              )}
            </Stack>
          )}

          <ArchiveHealthFixHistory
            entries={fixHistory}
            onUndo={(entry) => void handleUndoSafeFix(entry)}
            pendingActionId={pendingActionId}
          />
        </>
      )}
    </SectionCard>
  );
}
