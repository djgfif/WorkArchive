import { type FormEvent, useState } from 'react';
import { Box, Group } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  LoadingRows,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { JsonBackupReminderCard, useJsonArchiveExport, useJsonBackupReminder } from '@features/archive';
import { useAuthSession } from '@features/auth';
import {
  ArchiveSearchBar,
  WorkPoster,
  useWorksOverview,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '@features/works';
import styles from './HomePage.module.css';

const css = styles as Record<string, string>;

/* ── 유틸 ─────────────────────────────────────────────────────────────────── */

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

function pickContinueWorks(
  recentlyConsumed: WorkRecord[],
  active: WorkRecord[],
): WorkRecord[] {
  const seen = new Set<string>();
  const result: WorkRecord[] = [];
  for (const work of [...recentlyConsumed, ...active]) {
    if (!seen.has(work.id)) {
      seen.add(work.id);
      result.push(work);
    }
  }
  return result.slice(0, 12);
}

/* ── 선반 포스터 카드 ──────────────────────────────────────────────────────── */
function ShelfPosterCard({ work }: { work: WorkRecord }) {
  return (
    <div className={css.shelfItem}>
      <Link
        aria-label={`${work.title} 열기`}
        className={css.shelfCard}
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
          {/* 호버 오버레이 */}
          <div className={css.shelfCardOverlay} aria-hidden="true">
            <p className={css.shelfCardTitle}>{work.title}</p>
            <div className={css.shelfCardMeta}>
              <span className={css.shelfCardStatus}>
                {getWorkStatusLabel(work.status)}
              </span>
              {work.rating !== null && (
                <span className={css.shelfCardRating}>
                  ★ {work.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── 선반 섹션 ─────────────────────────────────────────────────────────────── */
interface ShelfSectionProps {
  eyebrow?: string;
  href: string;
  title: string;
  works: WorkRecord[];
}

function ShelfSection({ eyebrow, href, title, works }: ShelfSectionProps) {
  if (works.length === 0) return null;

  return (
    <section className={css.shelf}>
      <div className={css.shelfHeader}>
        <div>
          {eyebrow && <span className={css.shelfTitleEyebrow}>{eyebrow}</span>}
          <h2 className={css.shelfTitle}>{title}</h2>
        </div>
        <Link aria-label={`${title} 전체 보기`} className={css.shelfViewAll} to={href}>
          전체 보기 →
        </Link>
      </div>
      <div className={css.shelfTrack} role="list" aria-label={`${title} 선반`}>
        {works.map((work) => (
          <div key={work.id} role="listitem">
            <ShelfPosterCard work={work} />
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
  topTags,
  typeCounts,
}: Pick<
  ReturnType<typeof useWorksOverview>,
  'contributorCollections' | 'seriesCollections' | 'topTags' | 'typeCounts'
>): InsightItem[] {
  const items: InsightItem[] = [];
  const topType = typeCounts[0];
  if (topType) {
    items.push({
      description: '가장 많이 쌓인 유형',
      label: getWorkTypeLabel(topType.value),
      to: `/works?type=${encodeURIComponent(topType.value)}`,
      value: `${topType.count}개`,
    });
  }
  for (const tag of topTags.slice(0, 2)) {
    items.push({
      description: '자주 붙인 태그',
      label: `#${tag.label}`,
      to: `/works?tag=${encodeURIComponent(tag.value)}`,
      value: `${tag.count}개`,
    });
  }
  const topSeries = seriesCollections[0];
  if (topSeries) {
    items.push({
      description: '가장 큰 시리즈 묶음',
      label: topSeries.label,
      to: topSeries.href,
      value: `${topSeries.totalCount}개`,
    });
  }
  const topContributor = contributorCollections[0];
  if (topContributor) {
    items.push({
      description: '자주 만나는 제작진',
      label: topContributor.label,
      to: topContributor.href,
      value: `${topContributor.totalCount}개`,
    });
  }
  return items.slice(0, 6);
}

function InsightStrip({ items }: { items: InsightItem[] }) {
  if (items.length < 2) return null;
  return (
    <section className={css.insightStrip}>
      <div className={css.insightStripHeader}>
        <h2 className={css.shelfTitle}>작은 취향 단서</h2>
        <Link className={css.shelfViewAll} to="/insights">
          인사이트 →
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
  if (works.length === 0) return null;

  return (
    <section className={css.activitySection}>
      <div className={css.activityHeader}>
        <h2 className={css.activityTitle}>최근 정리한 감상</h2>
        <Link className={css.shelfViewAll} to="/works">
          서재 전체 →
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
                      : work.status === 'dropped'
                        ? 'error'
                        : 'muted'
                }
              >
                {getWorkStatusLabel(work.status)}
              </AppBadge>
            </div>
            <span className={css.activityMeta}>
              {formatRelativeDate(work.updatedAt)}
            </span>
            {work.rating !== null && (
              <span className={css.activityRating}>★ {work.rating.toFixed(1)}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── 빈 상태 가이드 ────────────────────────────────────────────────────────── */
function EmptyGuide() {
  const cards = [
    {
      icon: '✍️',
      title: '첫 작품 추가',
      description: '제목과 짧은 감상으로 첫 선반을 채웁니다.',
      to: '/works/new',
    },
    {
      icon: '🔍',
      title: '검색으로 추가',
      description: '외부 검색 후보에서 표지와 정보를 가져옵니다.',
      to: '/works/new',
    },
    {
      icon: '📦',
      title: '백업 가져오기',
      description: '이전에 내보낸 JSON 기록을 다시 불러옵니다.',
      to: '/account/settings#data-backup',
    },
  ];

  return (
    <div className={css.emptyGuide}>
      <h2 className={css.emptyGuideTitle}>첫 작품을 놓는 방법</h2>
      <p className={css.emptyGuideDesc}>
        새 작품을 직접 남기거나 검색으로 표지를 채우고, 기존 백업도 이어받을 수 있습니다.
      </p>
      <div className={css.emptyGuideGrid}>
        {cards.map((card) => (
          <Link className={css.emptyGuideCard} key={card.title} to={card.to}>
            <div className={css.emptyGuideCardIcon}>{card.icon}</div>
            <div className={css.emptyGuideCardTitle}>{card.title}</div>
            <div className={css.emptyGuideCardDesc}>{card.description}</div>
          </Link>
        ))}
      </div>
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
  const { archiveScopeKey, mode, user } = useAuthSession();
  const {
    averageRating,
    contributorCollections,
    error,
    highlyRatedWorks,
    inProgressCount,
    isLoading,
    recentlyConsumedWorks,
    recentWorks,
    retry,
    seriesCollections,
    topTags,
    totalCount,
    typeCounts,
    unratedCount,
  } = useWorksOverview();

  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';
  const jsonArchiveExport = useJsonArchiveExport();
  const backupReminder = useJsonBackupReminder(totalCount, archiveScopeKey);

  const activeWorks = recentWorks
    .filter((w) => w.status === 'in_progress')
    .slice(0, 12);
  const continueWorks = pickContinueWorks(recentlyConsumedWorks, activeWorks);
  const insightItems = buildInsightItems({
    contributorCollections,
    seriesCollections,
    topTags,
    typeCounts,
  });

  function handleSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const term = searchTerm.trim();
    navigate(term ? `/works?q=${encodeURIComponent(term)}` : '/works');
  }

  return (
    <div className={css.homePage}>
      {/* ── Greeting ── */}
      <div className={css.homeGreeting}>
        <div className={css.homeGreetingText}>
          <span className={css.homeEyebrow}>
            {isAuthenticated ? user?.email ?? '내 서재' : '내 서재'}
          </span>
          <h1 className={css.homeTitle}>오늘 펼쳐볼 작품</h1>
          <div className={css.homeStatStrip}>
            <span>작품</span>
            <span className={css.homeStatValue}>{totalCount}개</span>
            {inProgressCount > 0 && (
              <>
                <span className={css.homeStatDot} />
                <span>진행 중</span>
                <span className={css.homeStatValue}>{inProgressCount}개</span>
              </>
            )}
            {averageRating !== null && (
              <>
                <span className={css.homeStatDot} />
                <span>평균 별점</span>
                <span className={css.homeStatValue}>
                  ★ {averageRating.toFixed(1)}
                </span>
              </>
            )}
            {unratedCount > 0 && (
              <>
                <span className={css.homeStatDot} />
                <Link
                  className={css.shelfViewAll}
                  to="/works?sort=rating&dir=asc"
                  style={{ marginBottom: 0 }}
                >
                  평가 안 한 작품 {unratedCount}개
                </Link>
              </>
            )}
          </div>
        </div>
        <div className={css.homeActions}>
          <AppLinkButton to="/works/new" tone="primary">
            + 작품 추가
          </AppLinkButton>
          <AppLinkButton to="/works" tone="secondary">
            서재 전체
          </AppLinkButton>
        </div>
      </div>

      {/* ── 검색 ── */}
      <div className={css.homeSearchRow}>
        <form className={css.homeSearchForm} onSubmit={handleSearchSubmit}>
          <ArchiveSearchBar
            aria-label="아카이브 검색"
            onChange={setSearchTerm}
            onSubmit={() => handleSearchSubmit()}
            placeholder="작품, 작가를 검색"
            value={searchTerm}
          />
          <AppButton tone="primary" type="submit">
            검색
          </AppButton>
        </form>
      </div>

      {/* ── 오류 ── */}
      {error && (
        <Box p="xl" maw={1440} mx="auto">
          <StateMessage
            actions={
              <Group gap="sm">
                <AppButton onClick={retry} tone="primary" type="button">
                  다시 불러오기
                </AppButton>
                <AppLinkButton to="/works" tone="secondary">
                  작품 목록
                </AppLinkButton>
              </Group>
            }
            description={error}
            title="최근 기록을 불러오지 못했습니다."
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
          {/* 빈 상태 */}
          {totalCount === 0 && <EmptyGuide />}

          {/* 이어보기 선반 */}
          {continueWorks.length > 0 && (
            <ShelfSection
              eyebrow="이어보기"
              href="/works?status=in_progress"
              title="이어볼 작품"
              works={continueWorks}
            />
          )}

          {continueWorks.length > 0 && highlyRatedWorks.length > 0 && (
            <ShelfDivider />
          )}

          {/* 높게 평가한 작품 */}
          {highlyRatedWorks.length > 0 && (
            <ShelfSection
              eyebrow="추천 선반"
              href="/works?sort=rating&dir=desc"
              title="높게 평가한 작품"
              works={highlyRatedWorks}
            />
          )}

          {highlyRatedWorks.length > 0 && recentlyConsumedWorks.length > 0 && (
            <ShelfDivider />
          )}

          {/* 최근 감상 */}
          {recentlyConsumedWorks.length > 0 && (
            <ShelfSection
              eyebrow="최근 감상"
              href="/works"
              title="최근 감상한 작품"
              works={recentlyConsumedWorks.slice(0, 12)}
            />
          )}

          {/* 최근 추가 — 이어보기/감상 조건 없을 때 fallback 선반 */}
          {continueWorks.length === 0 &&
            recentlyConsumedWorks.length === 0 &&
            totalCount > 0 && (
              <ShelfSection
                eyebrow="최근 추가"
                href="/works"
                title="최근 추가한 작품"
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
          {insightItems.length > 0 && (
            <>
              <ShelfDivider />
              <InsightStrip items={insightItems} />
            </>
          )}

          {/* 최근 정리한 감상 */}
          {recentWorks.length > 0 && (
            <>
              <ShelfDivider />
              <ActivityStrip works={recentWorks} />
            </>
          )}
        </>
      )}
    </div>
  );
}
