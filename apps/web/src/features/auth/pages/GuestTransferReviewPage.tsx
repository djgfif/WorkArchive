import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
} from '../../../shared/components/AppPrimitives';
import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../hooks/useAuthSession';
import {
  guestTransferService,
  type GuestTransferReviewData,
} from '../services/guest-transfer.service';

export function GuestTransferReviewPage() {
  const { mode, user } = useAuthSession();
  const [review, setReview] = useState<GuestTransferReviewData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadReview() {
      if (!user) {
        return;
      }

      setIsLoading(true);

      try {
        const pendingReview = await guestTransferService.getPendingReview(user.id);

        if (isCancelled) {
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
        if (isCancelled) {
          return;
        }

        setSubmitError(
          error instanceof Error
            ? error.message
            : '게스트 기록 검토 상태를 불러오지 못했습니다.',
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      isCancelled = true;
    };
  }, [user]);

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
      setSubmitError(
        error instanceof Error
          ? error.message
          : '게스트 기록 상태를 저장하지 못했습니다.',
      );
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
        `선택한 ${result.importedCount}개 기록을 계정 로컬 아카이브로 가져왔습니다. Works 화면에서 바로 이어서 정리할 수 있습니다.`,
      );
      setReview(null);
      setSelectedIds([]);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '선택한 guest 기록을 가져오지 못했습니다.',
      );
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
          <AppLinkButton to="/works">Works로 이동</AppLinkButton>
          <AppLinkButton to="/account">계정 홈</AppLinkButton>
        </>
      }
      description="로그인 직후 guest 기록이 감지되면, 바로 계정 아카이브에 섞지 않고 먼저 중복 후보를 검토합니다."
      eyebrow="기록 이관"
      meta={
        review && (
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{review.totalActiveCount}</span>
              <span className="stat-pill-label">guest 기록</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{review.duplicateCount}</span>
              <span className="stat-pill-label">중복 후보</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{selectedCount}</span>
              <span className="stat-pill-label">선택됨</span>
            </div>
          </>
        )
      }
      title="게스트 기록 검토"
    >
      {isLoading && (
        <section className="panel stack">
          <p className="eyebrow">불러오는 중</p>
          <h2 className="section-title">guest 기록을 확인하고 있습니다</h2>
          <p className="muted-copy">잠시만 기다려주세요.</p>
        </section>
      )}

      {submitError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {submitError}
        </div>
      )}

      {resultMessage && (
        <section className="panel stack">
          <span className="mode-badge">반영 완료</span>
          <p className="muted-copy">{resultMessage}</p>
          <div className="button-row">
            <AppLinkButton to="/works" tone="primary">
              Works 열기
            </AppLinkButton>
          </div>
        </section>
      )}

      {!isLoading && review === null && !resultMessage && (
        <section className="panel stack">
          <span className="mode-badge">정리됨</span>
          <h2 className="section-title">지금 검토할 guest 기록이 없습니다</h2>
          <p className="muted-copy">
            새 guest 기록이 생기면 다시 검토 화면을 열 수 있습니다. 지금은 계정 아카이브를 바로 사용하면 됩니다.
          </p>
        </section>
      )}

      {!isLoading && review && (
        <>
          <section className="panel stack">
            <div className="section-heading">
              <p className="section-kicker">검토 원칙</p>
              <h2 className="section-title">중복 후보를 먼저 확인한 뒤 선택적으로 가져옵니다</h2>
              <p className="section-description">
                제목과 타입이 같은 항목은 기본 선택에서 제외했습니다. 가져올 항목만 체크하면 계정 로컬 아카이브로 복사됩니다.
              </p>
            </div>

            {duplicateSummary && <p className="muted-copy">{duplicateSummary}</p>}

            <div className="button-row">
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
                type="button"
              >
                이번 guest 기록은 건너뛰기
              </AppButton>
            </div>
          </section>

          <section className="stack">
            {review.items.map((item) => (
              <article className="panel stack" key={item.guestWork.id}>
                <div className="page-header">
                  <div>
                    <p className="section-kicker">
                      {item.guestWork.type} / {item.guestWork.status}
                    </p>
                    <h3 className="section-title">{item.guestWork.title}</h3>
                    <p className="muted-copy">
                      {item.guestWork.author || '작가 미입력'} · 별점{' '}
                      {item.guestWork.rating === null
                        ? '미평가'
                        : `${item.guestWork.rating.toFixed(1)}점`}
                    </p>
                  </div>
                  <label className="field field--checkbox">
                    <input
                      checked={selectedIds.includes(item.guestWork.id)}
                      onChange={() => toggleSelection(item.guestWork.id)}
                      type="checkbox"
                    />
                    <span>이 항목 가져오기</span>
                  </label>
                </div>

                {item.hasDuplicates ? (
                  <div className="stack">
                    <span className="mode-badge">중복 후보 있음</span>
                    {item.duplicateCandidates.map((candidate) => (
                      <p className="muted-copy" key={candidate.id}>
                        기존 계정 기록 후보: {candidate.title} / {candidate.type} /{' '}
                        {candidate.status}
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="badge">중복 후보 없음</span>
                )}

                {item.guestWork.shortReview && (
                  <p className="muted-copy">{item.guestWork.shortReview}</p>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </AccountPageTemplate>
  );
}
