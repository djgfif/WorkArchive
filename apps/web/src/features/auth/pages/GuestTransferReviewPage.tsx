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
    error.message.includes('게스트 기록 상태가 바뀌었습니다')
  ) {
    return '게스트 기록 상태가 바뀌었습니다. 다시 확인한 뒤 최신 목록에서 가져올 항목을 선택해주세요.';
  }

  if (context === 'load') {
    return '게스트 기록 검토 상태를 불러오지 못했습니다. 네트워크나 브라우저 저장 공간 상태를 확인한 뒤 다시 시도해주세요.';
  }

  if (context === 'skip') {
    return '검토 완료 상태를 저장하지 못했습니다. 다시 시도하거나 작품 목록에서 기록 상태를 먼저 확인해주세요.';
  }

  return '선택한 guest 기록을 가져오지 못했습니다. 목록을 다시 확인한 뒤 다시 시도해주세요.';
}

export function GuestTransferReviewPage() {
  usePageTitle('게스트 기록 이전');
  const { mode, user } = useAuthSession();
  const [review, setReview] = useState<GuestTransferReviewData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const loadReview = useCallback(async (options?: { isCancelled?: () => boolean }) => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    try {
      const pendingReview = await guestTransferService.getPendingReview(user.id);

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
  }, [user]);

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
        ? `${review.duplicateCount}개 항목에서 제목·타입 기준 중복 후보가 감지되었습니다.`
        : null,
    [review],
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
      setResultMessage(
        '이번 guest 기록은 건너뛰었습니다. 나중에 새 기록이 생기면 다시 검토할 수 있습니다.',
      );
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
        `선택한 ${result.importedCount}개 기록을 계정 로컬 아카이브로 가져왔습니다. 작품 화면에서 바로 이어서 정리할 수 있습니다.`,
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

  return (
    <AccountPageTemplate
      actions={
        <>
          <AppLinkButton to="/works">작품으로 이동</AppLinkButton>
          <AppLinkButton to="/account">계정 홈</AppLinkButton>
        </>
      }
      description="로그인 직후 guest 기록이 감지되면, 바로 계정 아카이브에 섞지 않고 먼저 중복 후보를 검토합니다."
      eyebrow="기록 이관"
      meta={
        review && (
          <>
            <MetricPill label="guest 기록" value={review.totalActiveCount} />
            <MetricPill label="중복 후보" value={review.duplicateCount} />
            <MetricPill label="선택됨" value={selectedCount} />
          </>
        )
      }
      title="게스트 기록 검토"
    >
      {isLoading && (
        <StateMessage
          description="잠시만 기다려주세요."
          eyebrow="불러오는 중"
          title="guest 기록을 확인하고 있습니다"
          tone="loading"
        />
      )}

      {submitError && (
        <FeedbackMessage title="게스트 기록을 처리하지 못했습니다" tone="error">
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
                  다시 확인
                </AppButton>
                <AppLinkButton to="/works" tone="quiet">
                  작품에서 확인
                </AppLinkButton>
              </ActionRow>
            )}
          </Stack>
        </FeedbackMessage>
      )}

      {resultMessage && (
        <SectionCard tone="subtle">
          <AppBadge tone="accent">반영 완료</AppBadge>
          <Text c="var(--mantine-color-dimmed)">{resultMessage}</Text>
          <ActionRow>
            <AppLinkButton to="/works" tone="primary">
              작품 열기
            </AppLinkButton>
          </ActionRow>
        </SectionCard>
      )}

      {!isLoading && review === null && !resultMessage && (
        <SectionCard tone="subtle">
          <AppBadge tone="accent">정리됨</AppBadge>
          <Title order={2}>지금 검토할 guest 기록이 없습니다</Title>
          <Text c="var(--mantine-color-dimmed)">
            새 guest 기록이 생기면 다시 검토 화면을 열 수 있습니다. 지금은 계정 아카이브를 바로 사용하면 됩니다.
          </Text>
        </SectionCard>
      )}

      {!isLoading && review && (
        <Stack gap="md">
          <SectionCard>
            <SectionIntro
              description="제목과 타입이 같은 항목은 기본 선택에서 제외했습니다. 가져올 항목만 체크하면 계정 로컬 아카이브로 복사됩니다."
              eyebrow="검토 원칙"
              title="중복 후보를 먼저 확인한 뒤 선택적으로 가져옵니다"
            />

            {duplicateSummary && (
              <Text c="var(--mantine-color-dimmed)">{duplicateSummary}</Text>
            )}

            <ActionRow>
              <AppButton
                disabled={!canSubmit}
                onClick={() => void handleImport()}
                tone="primary"
                type="button"
              >
                {isSubmitting ? '가져오는 중...' : `선택한 ${selectedCount}개 가져오기`}
              </AppButton>
              <AppButton
                disabled={isSubmitting}
                onClick={() => {
                  void handleSkip();
                }}
                tone="quiet"
                type="button"
              >
                이번 guest 기록은 건너뛰기
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
                      <AppBadge>{item.guestWork.type}</AppBadge>
                      <AppBadge>{item.guestWork.status}</AppBadge>
                      {item.hasDuplicates ? (
                        <AppBadge tone="warning">중복 후보 있음</AppBadge>
                      ) : (
                        <AppBadge tone="muted">중복 후보 없음</AppBadge>
                      )}
                    </ActionRow>

                    <div>
                      <Title order={3}>{item.guestWork.title}</Title>
                      <Text c="var(--mantine-color-dimmed)">
                        {item.guestWork.author || '작가 미입력'} · 별점{' '}
                        {item.guestWork.rating === null
                          ? '미평가'
                          : `${item.guestWork.rating.toFixed(1)}점`}
                      </Text>
                    </div>
                  </Stack>

                  <Checkbox
                    checked={selectedIds.includes(item.guestWork.id)}
                    label="이 항목 가져오기"
                    onChange={() => toggleSelection(item.guestWork.id)}
                  />
                </div>

                {item.hasDuplicates && (
                  <Stack gap="xs">
                    {item.duplicateCandidates.map((candidate) => (
                      <Text c="var(--mantine-color-dimmed)" key={candidate.id}>
                        기존 계정 기록 후보: {candidate.title} / {candidate.type} / {candidate.status}
                      </Text>
                    ))}
                  </Stack>
                )}

                {item.guestWork.shortReview && (
                  <Text c="var(--mantine-color-text)">{item.guestWork.shortReview}</Text>
                )}
              </SectionCard>
            ))}
          </Stack>
        </Stack>
      )}
    </AccountPageTemplate>
  );
}
