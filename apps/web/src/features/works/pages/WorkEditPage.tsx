import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  AppLinkButton,
  LoadingState,
  MetricPill,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { PageHero } from '@shared/components/PageHero';
import { FlowPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { syncQueueRepository } from '@features/sync';
import { WorkForm } from '../components/WorkForm';
import { useWorkDetail } from '../hooks/useWorkDetail';
import {
  graphRepository,
  type WorkGraphSnapshot,
} from '../services/graph.repository';
import { buildWorkFormDraftKey } from '../services/work-form-draft.service';
import { worksService } from '../services/works.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';
import {
  createWorkFormValuesFromRecord,
  type UpsertWorkInput,
} from '../utils/work-form';

export function WorkEditPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('works.edit.pageTitle'));
  const { id } = useParams();
  const navigate = useNavigate();
  const { archiveScopeKey, mode } = useAuthSession();
  const [searchParams] = useSearchParams();
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
  const focusArea =
    searchParams.get('focus') === 'review' ? 'review' : 'general';
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

      navigate(`/works/${id}?saved=edit`, {
        state: {
          feedback: hasQueuedWork
            ? t('works.feedback.localSavedSyncPending')
            : t('works.feedback.localSaved'),
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

  return (
    <FlowPageTemplate>
      <PageHero
        actions={
          <>
            <AppLinkButton to={`/works/${work.id}`}>
              {t('works.backToWork')}
            </AppLinkButton>
            {focusArea === 'review' && (
              <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
                {t('works.edit.fullMode')}
              </AppLinkButton>
            )}
          </>
        }
        description={
          focusArea === 'review'
            ? t('works.edit.reviewDescription')
            : t('works.edit.description')
        }
        eyebrow={t('common.edit')}
        meta={
          <>
            <MetricPill
              label={t('works.edit.workTitleLabel')}
              value={work.title}
            />
            <MetricPill
              label={t('works.edit.workModeLabel')}
              value={
                focusArea === 'review'
                  ? t('works.edit.reviewMode')
                  : t('works.edit.fullMode')
              }
            />
          </>
        }
        title={
          focusArea === 'review'
            ? t('works.edit.reviewTitle', { title: work.title })
            : t('works.edit.title', { title: work.title })
        }
      />

      <WorkForm
        catalogTitleId={work.catalogTitleId ?? null}
        cancelTo={`/works/${work.id}`}
        currentWorkId={work.id}
        draftKey={draftKey}
        focusArea={focusArea}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        organizationContributorSuggestions={
          workSuggestions.organizationContributorSuggestions
        }
        personContributorSuggestions={
          workSuggestions.personContributorSuggestions
        }
        seriesSuggestions={workSuggestions.seriesSuggestions}
        submitError={submitError}
        submitLabel={t('works.edit.submitLabel')}
        tagSuggestions={workSuggestions.tagSuggestions}
        {...(formInitialValues ? { initialValues: formInitialValues } : {})}
      />
    </FlowPageTemplate>
  );
}
