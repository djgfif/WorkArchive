import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
  FeedbackMessage,
  LoadingState,
  MetricPill,
  SectionCard,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { PageHero } from '@shared/components/PageHero';
import { FlowPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { syncQueueRepository } from '@features/sync';
import { WorkForm } from '../components/WorkForm';
import type { WorkFormFocusArea } from '../components/add-work-form.types';
import { useWorkDetail } from '../hooks/useWorkDetail';
import {
  graphRepository,
  type WorkGraphSnapshot,
} from '../services/graph.repository';
import { buildWorkFormDraftKey } from '../services/work-form-draft.service';
import { worksService } from '../services/works.service';
import {
  ARCHIVE_HEALTH_SETTINGS_PATH,
  archiveHealthReviewSessionService,
  buildArchiveHealthEditUrl,
  parseArchiveHealthIssueCodes,
} from '../services/archive-health-review-session.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';
import {
  createWorkFormValuesFromRecord,
  type UpsertWorkInput,
} from '../utils/work-form';

interface WorkEditRouteState {
  archiveHealthPreviousSaved?: boolean;
}

function getFocusArea(value: string | null): WorkFormFocusArea {
  if (value === 'archive-health' || value === 'review') {
    return value;
  }

  return 'general';
}

export function WorkEditPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('works.edit.pageTitle'));
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { archiveScopeKey, mode } = useAuthSession();
  const [searchParams] = useSearchParams();
  const routeState = location.state as WorkEditRouteState | null;
  const { error, isLoading, work } = useWorkDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [workSuggestions, setWorkSuggestions] = useState({
    organizationContributorSuggestions: [] as string[],
    personContributorSuggestions: [] as string[],
    seriesSuggestions: [] as string[],
    tagSuggestions: [] as string[],
  });
  const [workGraph, setWorkGraph] = useState<WorkGraphSnapshot | null>(null);
  const focusArea = getFocusArea(searchParams.get('focus'));
  const reviewSessionId =
    focusArea === 'archive-health'
      ? searchParams.get('reviewSession')
      : null;
  const reviewContext = useMemo(
    () =>
      focusArea === 'archive-health'
        ? archiveHealthReviewSessionService.getContext(reviewSessionId, id)
        : null,
    [focusArea, id, reviewSessionId],
  );
  const healthIssueCodes = useMemo(
    () =>
      reviewContext?.currentItem.issueCodes ??
      parseArchiveHealthIssueCodes(searchParams.get('issues')),
    [reviewContext, searchParams],
  );
  const draftKey = id
    ? buildWorkFormDraftKey({
        archiveScopeKey,
        focusArea,
        mode: 'edit',
        workId: id,
      })
    : null;
  const formInitialValues = useMemo(
    () =>
      work
        ? createWorkFormValuesFromRecord(work, workGraph ?? undefined)
        : undefined,
    [work, workGraph],
  );

  useEffect(() => {
    const subscription = liveQuery(() =>
      worksService.listWorks(DEFAULT_WORKS_LIST_QUERY, 'active'),
    ).subscribe({
      next: ({
        organizationContributorSuggestions,
        personContributorSuggestions,
        seriesSuggestions,
        tagSuggestions,
      }) => {
        setWorkSuggestions({
          organizationContributorSuggestions,
          personContributorSuggestions,
          seriesSuggestions,
          tagSuggestions,
        });
      },
      error: () => {
        setWorkSuggestions({
          organizationContributorSuggestions: [],
          personContributorSuggestions: [],
          seriesSuggestions: [],
          tagSuggestions: [],
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!work) {
      setWorkGraph(null);

      return undefined;
    }

    const subscription = liveQuery(() =>
      graphRepository.getWorkGraph(work.id),
    ).subscribe({
      next: setWorkGraph,
      error: () => setWorkGraph(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [work]);

  async function handleSubmit(input: UpsertWorkInput) {
    if (!id) {
      setSubmitError(t('works.edit.missingTitle'));
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await worksService.updateWork(id, input);
      const hasQueuedWork =
        mode === 'authenticated' &&
        (await syncQueueRepository.hasQueuedWork(id));
      const savedFeedback = hasQueuedWork
        ? t('works.feedback.localSavedSyncPending')
        : t('works.feedback.localSaved');

      if (focusArea === 'archive-health') {
        if (reviewContext?.nextItem) {
          navigate(
            buildArchiveHealthEditUrl(reviewContext.nextItem.workId, {
              issueCodes: reviewContext.nextItem.issueCodes,
              reviewSessionId: reviewContext.session.id,
            }),
            {
              replace: true,
              state: { archiveHealthPreviousSaved: true },
            },
          );
          return;
        }

        if (reviewContext) {
          archiveHealthReviewSessionService.remove(reviewContext.session.id);
        }

        navigate(ARCHIVE_HEALTH_SETTINGS_PATH, {
          replace: true,
          state: reviewContext
            ? { archiveHealthReviewCompleted: reviewContext.total }
            : { archiveHealthReviewSaved: true },
        });
        return;
      }

      navigate(`/works/${id}?saved=edit`, {
        state: {
          feedback: savedFeedback,
        },
      });
    } catch (saveError) {
      setSubmitError(
        saveError instanceof Error ? saveError.message : t('works.edit.error'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error) {
    return (
      <StateMessage
        description={error}
        title={t('works.list.loadError')}
        tone="error"
      />
    );
  }

  if (isLoading) {
    return <LoadingState rows={3} title={t('works.edit.loadingTitle')} />;
  }

  if (!work) {
    return (
      <StateMessage
        actions={
          <AppLinkButton to="/works" tone="primary">
            {t('works.backToWork')}
          </AppLinkButton>
        }
        description={t('works.edit.missingDescription')}
        title={t('works.edit.missingTitle')}
        tone="info"
      />
    );
  }

  const isHealthFocus = focusArea === 'archive-health';
  const cancelTo = isHealthFocus
    ? ARCHIVE_HEALTH_SETTINGS_PATH
    : `/works/${work.id}`;
  const focusModeLabel = isHealthFocus
    ? t('works.edit.healthMode')
    : focusArea === 'review'
      ? t('works.edit.reviewMode')
      : t('works.edit.fullMode');
  const submitLabel = isHealthFocus
    ? reviewContext?.nextItem
      ? t('works.edit.healthSaveNext')
      : reviewContext
        ? t('works.edit.healthSaveFinish')
        : t('works.edit.healthSaveReturn')
    : t('works.edit.submitLabel');

  return (
    <FlowPageTemplate>
      <PageHero
        actions={
          <>
            <AppLinkButton to={cancelTo}>
              {isHealthFocus
                ? t('works.edit.healthBack')
                : t('works.backToWork')}
            </AppLinkButton>
            {focusArea !== 'general' && (
              <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
                {t('works.edit.fullMode')}
              </AppLinkButton>
            )}
          </>
        }
        description={
          isHealthFocus
            ? t('works.edit.healthDescription')
            : focusArea === 'review'
            ? t('works.edit.reviewDescription')
            : t('works.edit.description')
        }
        eyebrow={t('common.edit')}
        meta={
          <>
            {reviewContext && (
              <MetricPill
                label={t('works.edit.healthProgressLabel')}
                value={t('works.edit.healthProgress', {
                  current: reviewContext.currentIndex + 1,
                  total: reviewContext.total,
                })}
              />
            )}
            <MetricPill
              label={t('works.edit.workTitleLabel')}
              value={work.title}
            />
            <MetricPill
              label={t('works.edit.workModeLabel')}
              value={focusModeLabel}
            />
          </>
        }
        title={
          isHealthFocus
            ? t('works.edit.healthTitle', { title: work.title })
            : focusArea === 'review'
            ? t('works.edit.reviewTitle', { title: work.title })
            : t('works.edit.title', { title: work.title })
        }
      />

      {routeState?.archiveHealthPreviousSaved && isHealthFocus && (
        <FeedbackMessage tone="success">
          {t('works.edit.healthPreviousSaved')}
        </FeedbackMessage>
      )}

      {isHealthFocus && healthIssueCodes.length > 0 && (
        <SectionCard>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={850}>{t('works.edit.healthIssueSummary')}</Text>
              <AppBadge tone="warning">
                {t('works.edit.healthIssueCount', {
                  count: healthIssueCodes.length,
                })}
              </AppBadge>
            </Group>
            <Stack gap={4}>
              {healthIssueCodes.map((issueCode) => (
                <Text key={issueCode} size="sm">
                  · {t(`settings.archiveHealth.issues.${issueCode}.title`)}
                </Text>
              ))}
            </Stack>
          </Stack>
        </SectionCard>
      )}

      <WorkForm
        catalogTitleId={work.catalogTitleId ?? null}
        cancelTo={cancelTo}
        currentWorkId={work.id}
        draftKey={draftKey}
        focusArea={focusArea}
        isSubmitting={isSubmitting}
        key={work.id}
        onSubmit={handleSubmit}
        organizationContributorSuggestions={
          workSuggestions.organizationContributorSuggestions
        }
        personContributorSuggestions={
          workSuggestions.personContributorSuggestions
        }
        seriesSuggestions={workSuggestions.seriesSuggestions}
        submitError={submitError}
        submitLabel={submitLabel}
        tagSuggestions={workSuggestions.tagSuggestions}
        {...(formInitialValues ? { initialValues: formInitialValues } : {})}
      />
    </FlowPageTemplate>
  );
}
