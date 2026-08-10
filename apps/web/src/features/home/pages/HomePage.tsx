import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useState,
} from 'react';
import { Box, Group } from '@mantine/core';
import type { TFunction } from 'i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { ProgressUnit, WorkRecord } from '@work-archive/shared-types';

import { formatAppNumber, useAppTranslation } from '@app/i18n';
import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  LoadingRows,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';
import {
  PosterHoverOverlay,
  POSTER_CARD_HOVER_CLASS,
} from '@shared/components/PosterHoverOverlay';
import {
  JsonBackupReminderCard,
  useJsonArchiveExport,
  useJsonBackupReminder,
} from '@features/archive';
import { useAuthSession } from '@features/auth';
import {
  useArchiveSafetyState,
  type ArchiveSafetyPresentation,
} from '@features/sync';
import {
  ArchiveSearchBar,
  WorkPoster,
  useWorksOverview,
  getProgressPercent,
  getWorkContinueLabel,
  getWorkStatusLabel,
  getWorkTypeLabel,
  worksService,
} from '@features/works';
import styles from './HomePage.module.css';
import { getHomeQuickProgressAction } from '../utils/home-quick-progress';

const css = styles;

function formatCount(count: number) {
  return formatAppNumber(count);
}

function getProgressUnitLabel(unit: ProgressUnit, t: TFunction) {
  return {
    chapter: t('works.record.progressControl.unitChapter'),
    episode: t('works.record.progressControl.unitEpisode'),
    volume: t('works.record.progressControl.unitVolume'),
  }[unit];
}

function formatRelativeDate(isoString: string, t: TFunction): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return t('home.relative.today');
  if (diffDays === 1) return t('home.relative.yesterday');
  if (diffDays < 7) {
    return t('home.relative.daysAgo', { count: formatCount(diffDays) });
  }
  if (diffDays < 30) {
    return t('home.relative.weeksAgo', {
      count: formatCount(Math.floor(diffDays / 7)),
    });
  }
  if (diffDays < 365) {
    return t('home.relative.monthsAgo', {
      count: formatCount(Math.floor(diffDays / 30)),
    });
  }
  return t('home.relative.yearsAgo', {
    count: formatCount(Math.floor(diffDays / 365)),
  });
}

/* ── 선반 포스터 카드 ──────────────────────────────────────────────────────── */
function ShelfPosterCard({
  isUpdating = false,
  onQuickProgress,
  showProgress = false,
  work,
}: {
  isUpdating?: boolean;
  onQuickProgress?: ((work: WorkRecord) => Promise<void>) | undefined;
  showProgress?: boolean;
  work: WorkRecord;
}) {
  const { t } = useAppTranslation();
  const quickProgressAction = showProgress
    ? getHomeQuickProgressAction(work)
    : null;
  const quickProgressUnitLabel = quickProgressAction
    ? getProgressUnitLabel(quickProgressAction.progressUnit, t)
    : null;
  const continueLabel = showProgress ? getWorkContinueLabel(work) : null;
  const progressPercent = showProgress ? getProgressPercent(work) : null;
  const footerPrefix =
    work.status === 'in_progress'
      ? t('home.shelf.continuePrefix')
      : getWorkStatusLabel(work.status);
  const footerText = continueLabel
    ? `${footerPrefix} · ${continueLabel}`
    : footerPrefix;
  const progressStyle =
    progressPercent === null
      ? undefined
      : ({
          '--home-progress-percent': `${progressPercent}%`,
        } as CSSProperties);

  return (
    <div className={css.shelfItem}>
      <Link
        aria-label={
          showProgress
            ? t('home.shelf.openWithMetaAria', {
                meta: footerText,
                title: work.title,
              })
            : t('home.shelf.openAria', { title: work.title })
        }
        className={`${css.shelfCard} ${POSTER_CARD_HOVER_CLASS}`}
        to={`/works/${work.id}`}
      >
        <div className={css.shelfCardInner}>
          <WorkPoster
            coverSeed={work.id}
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={getWorkTypeLabel(work.type)}
            variant="grid"
          />
          {/* 호버 오버레이 — 그리드 카드와 공용 */}
          <PosterHoverOverlay
            rating={work.rating}
            statusLabel={getWorkStatusLabel(work.status)}
            title={work.title}
          />
        </div>
        {showProgress && (
          <div className={css.shelfProgress}>
            {progressPercent !== null && (
              <div className={css.shelfProgressTrack} aria-hidden="true">
                <div className={css.shelfProgressFill} style={progressStyle} />
              </div>
            )}
            <span className={css.shelfProgressLabel}>
              <span className={css.shelfProgressGlyph} aria-hidden="true">
                ▸
              </span>
              {footerText}
            </span>
          </div>
        )}
      </Link>
      {quickProgressAction && quickProgressUnitLabel && onQuickProgress && (
        <AppButton
          aria-label={t('home.shelf.quickProgressAria', {
            next: formatCount(quickProgressAction.nextCurrent),
            title: work.title,
            unit: quickProgressUnitLabel,
          })}
          className={css.shelfQuickProgress ?? ''}
          disabled={isUpdating}
          loading={isUpdating}
          onClick={() => void onQuickProgress(work)}
          size="compact-sm"
          tone="secondary"
          type="button"
        >
          {t('home.shelf.quickProgressButton', {
            next: formatCount(quickProgressAction.nextCurrent),
            unit: quickProgressUnitLabel,
          })}
        </AppButton>
      )}
    </div>
  );
}

/* ── 선반 섹션 ─────────────────────────────────────────────────────────────── */
interface ShelfSectionProps {
  eyebrow?: string;
  href: string;
  onQuickProgress?: (work: WorkRecord) => Promise<void>;
  showProgress?: boolean;
  title: string;
  updatingWorkId?: string | null;
  works: WorkRecord[];
}

function ShelfSection({
  eyebrow,
  href,
  onQuickProgress,
  showProgress = false,
  title,
  updatingWorkId = null,
  works,
}: ShelfSectionProps) {
  const { t } = useAppTranslation();
  if (works.length === 0) return null;

  return (
    <section className={css.shelf}>
      <div className={css.shelfHeader}>
        <div>
          {eyebrow && <span className={css.shelfTitleEyebrow}>{eyebrow}</span>}
          <h2 className={css.shelfTitle}>{title}</h2>
        </div>
        <Link
          aria-label={t('home.shelf.viewAllAria', { title })}
          className={css.shelfViewAll}
          to={href}
        >
          {t('home.shelf.viewAll')}
        </Link>
      </div>
      <div
        className={css.shelfTrack}
        role="list"
        aria-label={t('home.shelf.trackAria', { title })}
      >
        {works.map((work) => (
          <div key={work.id} role="listitem">
            <ShelfPosterCard
              isUpdating={updatingWorkId === work.id}
              onQuickProgress={onQuickProgress}
              showProgress={showProgress}
              work={work}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 취향 단서 스트립 ──────────────────────────────────────────────────────── */
interface InsightItem {
  description: string;
  label: string;
  to: string;
  value: string;
}

function buildInsightItems({
  contributorCollections,
  seriesCollections,
  t,
  topTags,
  typeCounts,
}: Pick<
  ReturnType<typeof useWorksOverview>,
  'contributorCollections' | 'seriesCollections' | 'topTags' | 'typeCounts'
> & {
  t: TFunction;
}): InsightItem[] {
  const items: InsightItem[] = [];
  const topType = typeCounts[0];
  if (topType) {
    items.push({
      description: t('home.insights.topTypeDescription'),
      label: getWorkTypeLabel(topType.value),
      to: `/works?type=${encodeURIComponent(topType.value)}`,
      value: t('home.countValue', { count: formatCount(topType.count) }),
    });
  }
  for (const tag of topTags.slice(0, 2)) {
    items.push({
      description: t('home.insights.topTagDescription'),
      label: `#${tag.label}`,
      to: `/works?tag=${encodeURIComponent(tag.value)}`,
      value: t('home.countValue', { count: formatCount(tag.count) }),
    });
  }
  const topSeries = seriesCollections[0];
  if (topSeries) {
    items.push({
      description: t('home.insights.topSeriesDescription'),
      label: topSeries.label,
      to: topSeries.href,
      value: t('home.countValue', { count: formatCount(topSeries.totalCount) }),
    });
  }
  const topContributor = contributorCollections[0];
  if (topContributor) {
    items.push({
      description: t('home.insights.topContributorDescription'),
      label: topContributor.label,
      to: topContributor.href,
      value: t('home.countValue', {
        count: formatCount(topContributor.totalCount),
      }),
    });
  }
  return items.slice(0, 6);
}

function InsightStrip({ items }: { items: InsightItem[] }) {
  const { t } = useAppTranslation();
  if (items.length < 2) return null;
  return (
    <section className={css.insightStrip}>
      <div className={css.insightStripHeader}>
        <h2 className={css.shelfTitle}>{t('home.insights.title')}</h2>
        <Link className={css.shelfViewAll} to="/insights">
          {t('home.insights.link')}
        </Link>
      </div>
      <div className={css.insightGrid}>
        {items.map((item) => (
          <Link
            className={css.insightCard}
            key={`${item.description}:${item.label}`}
            to={item.to}
          >
            <div className={css.insightValue}>{item.value}</div>
            <div className={css.insightLabel}>{item.label}</div>
            <div className={css.insightDesc}>{item.description}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── 최근 기록 스트립 ──────────────────────────────────────────────────────── */
function ActivityStrip({ works }: { works: WorkRecord[] }) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  if (works.length === 0) return null;

  return (
    <section className={css.activitySection}>
      <div className={css.activityHeader}>
        <h2 className={css.activityTitle}>{t('home.activity.title')}</h2>
        <Link className={css.shelfViewAll} to="/works">
          {t('home.activity.link')}
        </Link>
      </div>
      <div className={css.activityList}>
        {works.slice(0, 8).map((work) => (
          <button
            className={css.activityItem}
            key={work.id}
            onClick={() => navigate(`/works/${work.id}`)}
            type="button"
          >
            <div className={css.activityDot} />
            <div className={css.activityBody}>
              <span className={css.activityItemTitle}>{work.title}</span>
              <AppBadge
                tone={
                  work.status === 'completed'
                    ? 'success'
                    : work.status === 'in_progress'
                      ? 'info'
                      : work.status === 'on_hold'
                        ? 'warning'
                        : work.status === 'dropped'
                          ? 'error'
                          : 'muted'
                }
              >
                {getWorkStatusLabel(work.status)}
              </AppBadge>
            </div>
            <span className={css.activityMeta}>
              {formatRelativeDate(work.updatedAt, t)}
            </span>
            {work.rating !== null && (
              <span className={css.activityRating}>
                <span className={css.statStar}>★</span> {work.rating.toFixed(1)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── 빈 상태 가이드 ────────────────────────────────────────────────────────── */
function GuideIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={22}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width={22}
    >
      {children}
    </svg>
  );
}

function EmptyGuide() {
  const { t } = useAppTranslation();
  const cards = [
    {
      icon: (
        <GuideIcon>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </GuideIcon>
      ),
      title: t('home.empty.manualTitle'),
      description: t('home.empty.manualDescription'),
      to: '/works/new',
    },
    {
      icon: (
        <GuideIcon>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </GuideIcon>
      ),
      title: t('home.empty.searchTitle'),
      description: t('home.empty.searchDescription'),
      to: '/works/new?mode=search',
    },
    {
      icon: (
        <GuideIcon>
          <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </GuideIcon>
      ),
      title: t('home.empty.backupTitle'),
      description: t('home.empty.backupDescription'),
      to: '/account/settings#data-backup',
    },
  ].filter(
    (card) => !isSitesGuestPoc() || card.to !== '/works/new?mode=search',
  );

  return (
    <section className={css.emptyGuide}>
      <div className={css.emptyGuideIntro}>
        <span className={css.emptyGuideIndex} aria-hidden="true">
          01
        </span>
        <div>
          <h2 className={css.emptyGuideTitle}>{t('home.empty.title')}</h2>
          <p className={css.emptyGuideDesc}>{t('home.empty.description')}</p>
        </div>
      </div>
      <div className={css.emptyGuideList}>
        {cards.map((card, index) => (
          <Link className={css.emptyGuideCard} key={card.title} to={card.to}>
            <span className={css.emptyGuideCardIndex} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={css.emptyGuideCardIcon}>{card.icon}</span>
            <span className={css.emptyGuideCardBody}>
              <strong className={css.emptyGuideCardTitle}>{card.title}</strong>
              <span className={css.emptyGuideCardDesc}>{card.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StarterArchivePanel({ works }: { works: WorkRecord[] }) {
  const { t } = useAppTranslation();
  const actions = [
    {
      description: t('home.empty.manualDescription'),
      title: t('home.empty.manualTitle'),
      to: '/works/new',
    },
    {
      description: t('home.empty.searchDescription'),
      title: t('home.empty.searchTitle'),
      to: '/works/new?mode=search',
    },
    {
      description: t('home.empty.backupDescription'),
      title: t('home.empty.backupTitle'),
      to: '/account/settings#data-backup',
    },
  ].filter(
    (action) => !isSitesGuestPoc() || action.to !== '/works/new?mode=search',
  );

  return (
    <section className={css.starterPanel}>
      <div className={css.starterArchive}>
        <div className={css.starterArchiveIntro}>
          <div className={css.starterArchiveIcon} aria-hidden="true">
            <GuideIcon>
              <path d="M4 4h16v16H4z" />
              <path d="M8 2v4M16 2v4M8 10h8M8 14h5" />
            </GuideIcon>
          </div>
          <div>
            <h2 className={css.starterArchiveTitle}>
              {t('home.starter.startedTitle')}
            </h2>
            <p className={css.starterArchiveDescription}>
              {t('home.starter.startedDescription')}
            </p>
          </div>
        </div>

        <div className={css.starterWorkList}>
          {works.slice(0, 3).map((work) => (
            <Link
              className={css.starterWorkRow}
              key={work.id}
              to={`/works/${work.id}`}
            >
              <WorkPoster
                coverSeed={work.id}
                thumbnailUrl={work.thumbnailUrl}
                title={work.title}
                typeLabel={getWorkTypeLabel(work.type)}
                variant="row"
              />
              <span className={css.starterWorkBody}>
                <strong>{work.title}</strong>
                <span>
                  {getWorkTypeLabel(work.type)} ·{' '}
                  {getWorkStatusLabel(work.status)}
                </span>
              </span>
              <span className={css.starterWorkMeta}>
                {formatRelativeDate(work.updatedAt, t)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className={css.starterActions}>
        {actions.map((action) => (
          <Link className={css.starterAction} key={action.title} to={action.to}>
            <span className={css.starterActionBody}>
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </span>
            <span className={css.starterActionArrow} aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ArchiveSafetyDock({
  presentation,
}: {
  presentation: ArchiveSafetyPresentation;
}) {
  return (
    <div className={css.safetyDock}>
      <span className={css.safetyDockStatus}>
        <span className={css.safetyDockCheck} aria-hidden="true">
          •
        </span>
        <span>{presentation.title}</span>
        <strong>{presentation.jsonBackupLabel}</strong>
      </span>
      <span className={css.safetyDockDescription}>
        {presentation.description}
      </span>
      <Link
        aria-label={presentation.badge.label}
        className={css.safetyDockLink}
        to={presentation.badge.to}
      >
        <span className={css.safetyDockLinkLabel}>
          {presentation.badge.label}
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/* ── 구분선 ────────────────────────────────────────────────────────────────── */
function ShelfDivider() {
  return <div className={css.shelfDivider} aria-hidden="true" />;
}

/* ── 메인 페이지 ────────────────────────────────────────────────────────────── */
export function HomePage() {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { archiveScopeKey } = useAuthSession();
  const {
    continueWorks,
    contributorCollections,
    error,
    highlyRatedWorks,
    isLoading,
    recentlyConsumedWorks,
    recentWorks,
    retry,
    seriesCollections,
    topTags,
    totalCount,
    typeCounts,
  } = useWorksOverview();

  const [progressFeedback, setProgressFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingProgressWorkId, setUpdatingProgressWorkId] = useState<
    string | null
  >(null);
  // 빈 서재에서는 검색·"서재 전체" 같은 빈 결과로 가는 컨트롤을 숨기고
  // 첫 기록 가이드에 시선을 모은다.
  const isEmptyArchive = !error && !isLoading && totalCount === 0;
  const jsonArchiveExport = useJsonArchiveExport();
  const backupReminder = useJsonBackupReminder(totalCount, archiveScopeKey);
  const archiveSafety = useArchiveSafetyState();

  const insightItems = buildInsightItems({
    contributorCollections,
    seriesCollections,
    t,
    topTags,
    typeCounts,
  });

  function handleSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const term = searchTerm.trim();
    navigate(
      term ? `/works/new?title=${encodeURIComponent(term)}` : '/works/new',
    );
  }

  async function handleQuickProgress(work: WorkRecord) {
    try {
      setProgressFeedback(null);
      setUpdatingProgressWorkId(work.id);

      const latestWork = await worksService.getWorkById(work.id);
      const action = latestWork ? getHomeQuickProgressAction(latestWork) : null;

      if (!latestWork || !action) {
        throw new Error(t('home.shelf.quickProgressUnavailable'));
      }

      const unit = getProgressUnitLabel(action.progressUnit, t);
      await worksService.updateProgress(latestWork.id, {
        lastConsumedLabel: t('works.list.progressConsumedLabel', {
          current: action.nextCurrent,
          unit,
        }),
        progressCurrent: action.nextCurrent,
        progressTotal: action.progressTotal,
        progressUnit: action.progressUnit,
      });
      setProgressFeedback({
        message: t('home.shelf.quickProgressSaved', {
          next: formatCount(action.nextCurrent),
          title: latestWork.title,
          unit,
        }),
        tone: 'success',
      });
    } catch (progressError) {
      setProgressFeedback({
        message:
          progressError instanceof Error
            ? progressError.message
            : t('home.shelf.quickProgressError'),
        tone: 'error',
      });
    } finally {
      setUpdatingProgressWorkId(null);
    }
  }

  return (
    <div className={css.homePage}>
      <div className={css.commandCenter}>
        <div className={css.archiveHeading}>
          <div className={css.archiveHeadingCopy}>
            <div className={css.archiveHeadingTitle}>
              <h1>{t('home.starter.archiveTitle')}</h1>
              <span>
                {t('home.starter.archiveCount', {
                  count: formatCount(totalCount),
                })}
              </span>
            </div>
            <p className={css.archiveHeadingDescription}>
              {isEmptyArchive
                ? t('home.starter.archiveEmptyDescription')
                : t('home.starter.archiveDescription')}
            </p>
          </div>
          {!isEmptyArchive && (
            <AppLinkButton to="/works" tone="secondary">
              {t('home.actions.allWorks')}
            </AppLinkButton>
          )}
        </div>

        <form className={css.quickCaptureForm} onSubmit={handleSearchSubmit}>
          <ArchiveSearchBar
            aria-label={t('home.quickCapture.aria')}
            onChange={setSearchTerm}
            onSubmit={() => handleSearchSubmit()}
            placeholder={t('home.quickCapture.placeholder')}
            value={searchTerm}
          />
          <AppButton
            aria-label={t('home.quickCapture.record')}
            className={css.quickCaptureSubmit ?? ''}
            tone="primary"
            type="submit"
          >
            <span className={css.quickCaptureSubmitLabel}>
              {t('home.quickCapture.record')}
            </span>
            <span aria-hidden="true" className={css.quickCaptureSubmitIcon}>
              →
            </span>
          </AppButton>
        </form>
        {progressFeedback && (
          <div className={css.quickProgressFeedback}>
            <FeedbackMessage tone={progressFeedback.tone}>
              {progressFeedback.message}
            </FeedbackMessage>
          </div>
        )}
      </div>

      {/* ── 오류 ── */}
      {error && (
        <Box p="xl" maw={1440} mx="auto">
          <StateMessage
            actions={
              <Group gap="sm">
                <AppButton onClick={retry} tone="primary" type="button">
                  {t('home.error.retry')}
                </AppButton>
                <AppLinkButton to="/works" tone="secondary">
                  {t('home.error.works')}
                </AppLinkButton>
              </Group>
            }
            description={error}
            title={t('home.error.title')}
            tone="error"
          />
        </Box>
      )}

      {/* ── 로딩 ── */}
      {!error && isLoading && (
        <Box px="xl" maw={1440} mx="auto">
          <LoadingRows rows={4} />
        </Box>
      )}

      {/* ── 콘텐츠 ── */}
      {!error && !isLoading && (
        <>
          {totalCount === 0 && <EmptyGuide />}
          {totalCount > 0 && totalCount <= 3 && (
            <StarterArchivePanel works={recentWorks} />
          )}

          {/* 이어보기 선반 */}
          {totalCount > 3 && continueWorks.length > 0 && (
            <ShelfSection
              eyebrow={t('home.shelves.continueEyebrow')}
              href="/works?status=in_progress"
              onQuickProgress={handleQuickProgress}
              showProgress
              title={t('home.shelves.continueTitle')}
              updatingWorkId={updatingProgressWorkId}
              works={continueWorks}
            />
          )}

          {totalCount > 3 &&
            continueWorks.length > 0 &&
            highlyRatedWorks.length > 0 && <ShelfDivider />}

          {/* 높게 평가한 작품 */}
          {totalCount > 3 && highlyRatedWorks.length > 0 && (
            <ShelfSection
              eyebrow={t('home.shelves.recommendedEyebrow')}
              href="/works?sort=rating&dir=desc"
              title={t('home.shelves.highlyRatedTitle')}
              works={highlyRatedWorks}
            />
          )}

          {totalCount > 3 &&
            highlyRatedWorks.length > 0 &&
            recentlyConsumedWorks.length > 0 && <ShelfDivider />}

          {/* 최근 감상 */}
          {totalCount > 3 && recentlyConsumedWorks.length > 0 && (
            <ShelfSection
              eyebrow={t('home.shelves.recentConsumedEyebrow')}
              href="/works"
              title={t('home.shelves.recentConsumedTitle')}
              works={recentlyConsumedWorks.slice(0, 12)}
            />
          )}

          {/* 최근 추가 — 이어보기/감상 조건 없을 때 fallback 선반 */}
          {totalCount > 3 &&
            continueWorks.length === 0 &&
            recentlyConsumedWorks.length === 0 &&
            totalCount > 0 && (
              <ShelfSection
                eyebrow={t('home.shelves.recentAddedEyebrow')}
                href="/works"
                title={t('home.shelves.recentAddedTitle')}
                works={recentWorks.slice(0, 12)}
              />
            )}

          {/* 백업 알림 */}
          {backupReminder.shouldShow && (
            <div className={css.backupSlot}>
              <JsonBackupReminderCard
                feedback={jsonArchiveExport.feedback}
                isExporting={jsonArchiveExport.isExporting}
                onExportJson={jsonArchiveExport.exportJson}
                reminder={backupReminder}
              />
            </div>
          )}

          {/* 취향 단서 */}
          {totalCount > 3 && insightItems.length > 0 && (
            <>
              <ShelfDivider />
              <InsightStrip items={insightItems} />
            </>
          )}

          {/* 최근 정리한 감상 */}
          {totalCount > 3 && recentWorks.length > 0 && (
            <>
              <ShelfDivider />
              <ActivityStrip works={recentWorks} />
            </>
          )}

          <ArchiveSafetyDock presentation={archiveSafety.presentation} />
        </>
      )}
    </div>
  );
}
