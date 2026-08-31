import { useCallback, useEffect, useMemo, useState } from 'react';
import { Checkbox, Stack, Text, Title } from '@mantine/core';
import { Navigate } from 'react-router-dom';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { AccountPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { appI18n, useAppTranslation } from '@app/i18n';
import { useAuthSession } from '../hooks/useAuthSession';
import {
  guestTransferService,
  type GuestTransferReviewData,
} from '../services/guest-transfer.service';

type GuestTransferErrorContext = 'import' | 'load' | 'skip';

function getGuestTransferErrorMessage(
  error: unknown,
  context: GuestTransferErrorContext,
) {
  if (
    error instanceof Error &&
    error.message.includes(appI18n.t('auth.guestTransfer.errorChangedMatch'))
  ) {
    return appI18n.t('auth.guestTransfer.errorChanged');
  }

  if (context === 'load') {
    return appI18n.t('auth.guestTransfer.errorLoad');
  }

  if (context === 'skip') {
    return appI18n.t('auth.guestTransfer.errorSkip');
  }

  return appI18n.t('auth.guestTransfer.errorGeneric');
}

export function GuestTransferReviewPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('auth.guestTransfer.pageTitle'));
  const { mode, user } = useAuthSession();
  const [review, setReview] = useState<GuestTransferReviewData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const loadReview = useCallback(
    async (options?: { isCancelled?: () => boolean }) => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setSubmitError(null);

      try {
        const pendingReview = await guestTransferService.getPendingReview(
          user.id,
        );

        if (options?.isCancelled?.()) {
          return;
        }

        setReview(pendingReview);
        setSelectedIds(
          pendingReview
            ? pendingReview.items
                .filter((item) => !item.hasDuplicates)
                .map((item) => item.guestWork.id)
            : [],
        );
      } catch (error) {
        if (options?.isCancelled?.()) {
          return;
        }

        setReview(null);
        setSelectedIds([]);
        setSubmitError(getGuestTransferErrorMessage(error, 'load'));
      } finally {
        if (!options?.isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    let isCancelled = false;

    void loadReview({
      isCancelled: () => isCancelled,
    });

    return () => {
      isCancelled = true;
    };
  }, [loadReview]);

  const selectedCount = selectedIds.length;
  const canSubmit = review !== null && selectedCount > 0 && !isSubmitting;
  const duplicateSummary = useMemo(
    () =>
      review
        ? t('auth.guestTransfer.duplicateSummary', {
            count: review.duplicateCount,
          })
        : null,
    [review, t],
  );

  if (mode !== 'authenticated' || !user) {
    return <Navigate replace to="/auth/login" />;
  }

  const authenticatedUser = user;

  async function handleSkip() {
    if (!review) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await guestTransferService.markReviewed(
        authenticatedUser.id,
        review.fingerprint,
      );
      setResultMessage(t('auth.guestTransfer.skipSuccess'));
      setReview(null);
      setSelectedIds([]);
    } catch (error) {
      setSubmitError(getGuestTransferErrorMessage(error, 'skip'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImport() {
    if (!review) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await guestTransferService.importSelected(
        authenticatedUser.id,
        review.fingerprint,
        selectedIds,
      );

      setResultMessage(
        t('auth.guestTransfer.importSuccess', {
          count: result.importedCount,
        }),
      );
      setReview(null);
      setSelectedIds([]);
    } catch (error) {
      setSubmitError(getGuestTransferErrorMessage(error, 'import'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSelection(workId: string) {
    setSelectedIds((currentValue) =>
      currentValue.includes(workId)
        ? currentValue.filter((id) => id !== workId)
        : [...currentValue, workId],
    );
  }

  function selectAllGuestRecords() {
    if (!review) {
      return;
    }

    setSelectedIds(review.items.map((item) => item.guestWork.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <AccountPageTemplate
      actions={
        <>
          <AppLinkButton to="/works">
            {t('auth.guestTransfer.actionWorks')}
          </AppLinkButton>
          <AppLinkButton to="/account">
            {t('auth.guestTransfer.actionAccount')}
          </AppLinkButton>
        </>
      }
      description={t('auth.guestTransfer.description')}
      eyebrow={t('auth.guestTransfer.eyebrow')}
      meta={
        review && (
          <>
            <MetricPill
              label={t('auth.guestTransfer.metricGuestRecords')}
              value={review.totalActiveCount}
            />
            <MetricPill
              label={t('auth.guestTransfer.metricDuplicates')}
              value={review.duplicateCount}
            />
            <MetricPill
              label={t('auth.guestTransfer.metricSelected')}
              value={selectedCount}
            />
          </>
        )
      }
      title={t('auth.guestTransfer.title')}
    >
      {isLoading && (
        <StateMessage
          description={t('auth.guestTransfer.loadingDescription')}
          eyebrow={t('auth.guestTransfer.loadingEyebrow')}
          title={t('auth.guestTransfer.loadingTitle')}
          tone="loading"
        />
      )}

      {submitError && (
        <FeedbackMessage
          title={t('auth.guestTransfer.errorTitle')}
          tone="error"
        >
          <Stack gap="sm">
            <Text>{submitError}</Text>
            {!isLoading && review === null && !resultMessage && (
              <ActionRow>
                <AppButton
                  disabled={isSubmitting}
                  onClick={() => void loadReview()}
                  tone="primary"
                  type="button"
                >
                  {t('auth.guestTransfer.actionRetry')}
                </AppButton>
                <AppLinkButton to="/works" tone="quiet">
                  {t('auth.guestTransfer.actionViewInWorks')}
                </AppLinkButton>
              </ActionRow>
            )}
          </Stack>
        </FeedbackMessage>
      )}

      {resultMessage && (
        <SectionCard tone="subtle">
          <AppBadge tone="accent">
            {t('auth.guestTransfer.resultBadge')}
          </AppBadge>
          <Text c="var(--mantine-color-dimmed)">{resultMessage}</Text>
          <ActionRow>
            <AppLinkButton to="/works" tone="primary">
              {t('auth.guestTransfer.resultOpenWorks')}
            </AppLinkButton>
          </ActionRow>
        </SectionCard>
      )}

      {!isLoading && review === null && !resultMessage && (
        <SectionCard tone="subtle">
          <AppBadge tone="accent">
            {t('auth.guestTransfer.reviewedBadge')}
          </AppBadge>
          <Title order={2}>{t('auth.guestTransfer.emptyTitle')}</Title>
          <Text c="var(--mantine-color-dimmed)">
            {t('auth.guestTransfer.emptyDescription')}
          </Text>
        </SectionCard>
      )}

      {!isLoading && review && (
        <Stack gap="md">
          <SectionCard>
            <SectionIntro
              description={t('auth.guestTransfer.ruleDescription')}
              eyebrow={t('auth.guestTransfer.ruleEyebrow')}
              title={t('auth.guestTransfer.ruleTitle')}
            />

            {duplicateSummary && (
              <Text c="var(--mantine-color-dimmed)">{duplicateSummary}</Text>
            )}

            <Text c="var(--mantine-color-dimmed)">
              {t('auth.guestTransfer.skipPreservesGuest')}
            </Text>

            <ActionRow>
              <AppButton
                disabled={isSubmitting || selectedCount === review.items.length}
                onClick={selectAllGuestRecords}
                tone="secondary"
                type="button"
              >
                {t('auth.guestTransfer.actionSelectAll')}
              </AppButton>
              <AppButton
                disabled={isSubmitting || selectedCount === 0}
                onClick={clearSelection}
                tone="quiet"
                type="button"
              >
                {t('auth.guestTransfer.actionClearSelection')}
              </AppButton>
            </ActionRow>

            <ActionRow>
              <AppButton
                disabled={!canSubmit}
                onClick={() => void handleImport()}
                tone="primary"
                type="button"
              >
                {isSubmitting
                  ? t('auth.guestTransfer.actionImporting')
                  : t('auth.guestTransfer.actionImportSelected', {
                      count: selectedCount,
                    })}
              </AppButton>
              <AppButton
                disabled={isSubmitting}
                onClick={() => {
                  void handleSkip();
                }}
                tone="quiet"
                type="button"
              >
                {t('auth.guestTransfer.actionSkip')}
              </AppButton>
            </ActionRow>
          </SectionCard>

          <Stack gap="md">
            {review.items.map((item) => (
              <SectionCard key={item.guestWork.id} padding="lg">
                <div
                  style={{
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <Stack gap="sm" style={{ flex: '1 1 20rem' }}>
                    <ActionRow>
                      <AppBadge>
                        {t(`works.type.${item.guestWork.type}`)}
                      </AppBadge>
                      <AppBadge>
                        {t(`works.status.${item.guestWork.status}`)}
                      </AppBadge>
                      {item.hasDuplicates ? (
                        <AppBadge tone="warning">
                          {t('auth.guestTransfer.duplicateBadge')}
                        </AppBadge>
                      ) : (
                        <AppBadge tone="muted">
                          {t('auth.guestTransfer.duplicateNoneBadge')}
                        </AppBadge>
                      )}
                    </ActionRow>

                    <div>
                      <Title order={3}>{item.guestWork.title}</Title>
                      <Text c="var(--mantine-color-dimmed)">
                        {item.guestWork.author ||
                          t('auth.guestTransfer.authorMissing')}{' '}
                        · {t('auth.guestTransfer.ratingLabel')}{' '}
                        {item.guestWork.rating === null
                          ? t('auth.guestTransfer.noRating')
                          : t('works.rating.semanticValue', {
                              value: item.guestWork.rating.toFixed(1),
                            })}
                      </Text>
                    </div>
                  </Stack>

                  <Checkbox
                    checked={selectedIds.includes(item.guestWork.id)}
                    label={t('auth.guestTransfer.itemCheckbox')}
                    onChange={() => toggleSelection(item.guestWork.id)}
                  />
                </div>

                {item.hasDuplicates && (
                  <Stack gap="xs">
                    {item.duplicateCandidates.map((candidate) => (
                      <Text c="var(--mantine-color-dimmed)" key={candidate.id}>
                        {t('auth.guestTransfer.candidatePrefix')}{' '}
                        {candidate.title} / {t(`works.type.${candidate.type}`)}{' '}
                        / {t(`works.status.${candidate.status}`)}
                      </Text>
                    ))}
                  </Stack>
                )}

                {item.guestWork.shortReview && (
                  <Text c="var(--mantine-color-text)">
                    {item.guestWork.shortReview}
                  </Text>
                )}
              </SectionCard>
            ))}
          </Stack>
        </Stack>
      )}
    </AccountPageTemplate>
  );
}
