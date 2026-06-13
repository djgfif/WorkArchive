import { useState } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { PageHero } from '@shared/components/PageHero';
import { FlowPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { withKoreanParticle } from '@shared/utils/korean-particle';
import { useAuthSession } from '@features/auth';
import { syncQueueRepository } from '@features/sync';
import { AddWorkFlow } from '../components/AddWorkFlow';
import { buildWorkFormDraftKey } from '../services/work-form-draft.service';
import { worksService } from '../services/works.service';
import { getWorkMediaFieldLabels } from '../utils/work-media-labels';
import type { UpsertWorkInput } from '../utils/work-form';
import { getWorkStatusLabel, getWorkTypeLabel } from '../utils/work-options';

type KoreanParticlePair = Parameters<typeof withKoreanParticle>[1];

export function WorkCreatePage() {
  const { t } = useAppTranslation();
  usePageTitle(t('works.add.title'));
  const { archiveScopeKey, mode } = useAuthSession();
  const [formVersion, setFormVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedWork, setSavedWork] = useState<WorkRecord | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftKey = buildWorkFormDraftKey({
    archiveScopeKey,
    focusArea: 'general',
    mode: 'create',
  });
  const savedWorkMediaLabels = savedWork
    ? getWorkMediaFieldLabels(savedWork.type)
    : null;

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);
      const hasQueuedWork =
        mode === 'authenticated' &&
        (await syncQueueRepository.hasQueuedWork(work.id));

      setSavedWork(work);
      setSaveFeedback(
        hasQueuedWork
          ? t('works.feedback.localSavedSyncPending')
          : t('works.feedback.localSaved'),
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('works.add.error'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FlowPageTemplate>
      <PageHero
        actions={
          <AppLinkButton to="/works">{t('works.backToWork')}</AppLinkButton>
        }
        description={t('works.add.description')}
        eyebrow={t('works.add.eyebrow')}
        title={t('works.add.title')}
      />

      {savedWork ? (
        <SectionCard gap="lg" padding="xl" tone="default">
          <SectionIntro
            description={t('works.add.savedDescription')}
            eyebrow={t('works.add.savedEyebrow')}
            title={t('works.add.savedTitle', {
              title: withKoreanParticle(
                savedWork.title,
                t('works.add.savedTitleParticle') as KoreanParticlePair,
              ),
            })}
          />

          {saveFeedback && (
            <FeedbackMessage tone="success">{saveFeedback}</FeedbackMessage>
          )}

          <Group align="flex-start" gap="md" wrap="nowrap">
            <ArtworkPoster
              thumbnailUrl={savedWork.thumbnailUrl}
              title={savedWork.title}
              typeLabel={getWorkTypeLabel(savedWork.type)}
              variant="row"
            />

            <Stack gap="sm" miw={0}>
              <ActionRow>
                <AppBadge>{getWorkTypeLabel(savedWork.type)}</AppBadge>
                <AppBadge>{getWorkStatusLabel(savedWork.status)}</AppBadge>
                <AppBadge>
                  {savedWork.rating === null
                    ? t('works.ratingMissing')
                    : t('works.rating.semanticValue', {
                        value: savedWork.rating.toFixed(1),
                      })}
                </AppBadge>
              </ActionRow>

              <div>
                <Title order={3}>{savedWork.title}</Title>
                <Text c="var(--mantine-color-dimmed)">
                  {savedWork.author || savedWorkMediaLabels?.authorEmptyLabel}
                </Text>
              </div>
            </Stack>
          </Group>

          <ActionRow>
            <AppButton
              onClick={() => {
                setSavedWork(null);
                setSaveFeedback(null);
                setSubmitError(null);
                setFormVersion((currentValue) => currentValue + 1);
              }}
              tone="primary"
              type="button"
            >
              {t('works.add.continueAdding')}
            </AppButton>
            <AppLinkButton to={`/works/${savedWork.id}`}>
              {t('works.add.showCreatedWork')}
            </AppLinkButton>
            <AppLinkButton to="/works" tone="quiet">
              {t('works.add.showWorksList')}
            </AppLinkButton>
          </ActionRow>
        </SectionCard>
      ) : (
        <AddWorkFlow
          draftKey={draftKey}
          isSubmitting={isSubmitting}
          key={formVersion}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      )}
    </FlowPageTemplate>
  );
}
