import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { KeyboardEvent, PointerEvent } from 'react';
import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import { usePosterImageSource } from '@shared/components/usePosterImageSource';
import {
  formatWorkDate,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import { getPersonalTags } from '../utils/graph-tags';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from './archive-display';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

type PosterVariant = 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';

const posterVariantClass: Record<PosterVariant, string> = {
  card: cn(css.posterCard),
  detail: cn(css.posterDetail),
  form: cn(css.posterForm),
  grid: cn(css.posterGrid),
  hero: cn(css.posterHero),
  row: cn(css.posterRow),
};

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

const progressCurrentLabels: Record<ProgressUnit, string> = {
  chapter: '읽은 화',
  episode: '본 회차',
  volume: '읽은 권',
};

const progressTotalLabels: Record<ProgressUnit, string> = {
  chapter: '전체 화',
  episode: '전체 회차',
  volume: '전체 권',
};

const lastPositionLabels: Record<ProgressUnit, string> = {
  chapter: '마지막으로 읽은 위치',
  episode: '마지막으로 본 위치',
  volume: '마지막으로 읽은 위치',
};

interface WorkPosterProps {
  className?: string;
  coverSeed?: string;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: PosterVariant;
}

interface WorkPosterCardProps {
  isUpdating?: boolean;
  work: WorkRecord;
}

interface WorkRowCardProps {
  isUpdating?: boolean;
  work: WorkRecord;
}

interface WorkShelfProps {
  empty?: ReactNode;
  title?: ReactNode;
  works: WorkRecord[];
}

interface ArchiveHeroProps {
  actions?: ReactNode;
  children?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  variant?: 'default' | 'compact' | 'landing';
  visual?: ReactNode;
}

interface RatingDisplayProps {
  compact?: boolean;
  value: number | null;
}

interface ProgressDisplayProps {
  work: WorkRecord;
}

interface QuickProgressControlProps {
  disabled?: boolean;
  onSave: (update: {
    lastConsumedLabel: string;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: ProgressUnit;
  }) => Promise<void>;
  work: WorkRecord;
}

interface ReviewNoteCardProps {
  emptyLabel?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

interface FilterPillOption<T extends string> {
  count?: number;
  label: string;
  value: T;
}

interface FilterPillGroupProps<T extends string> {
  'aria-label'?: string;
  onChange: (value: T) => void;
  options: Array<FilterPillOption<T>>;
  value: T;
}

interface SegmentedChoiceOption<T extends string> {
  description?: string;
  label: string;
  value: T;
}

interface SegmentedChoiceGroupProps<T extends string> {
  'aria-label': string;
  label: ReactNode;
  onChange: (value: T) => void;
  options: Array<SegmentedChoiceOption<T>>;
  value: T;
}

interface ArchiveSearchBarProps {
  'aria-label': string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}

interface ArchiveEmptyStateProps {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function coerceNumberInputValue(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function getPrimaryMetaLine(work: WorkRecord) {
  const ratingLabel = work.rating === null ? '미평가' : `★ ${work.rating.toFixed(1)}`;

  return [ratingLabel, getWorkStatusLabel(work.status)]
    .filter(Boolean)
    .join(' · ');
}

function getPosterAuthorLine(work: WorkRecord) {
  return work.author.trim() || '작가·제작자 미입력';
}

function needsPosterCuration(work: WorkRecord) {
  return (
    work.rating === null ||
    work.shortReview.trim() === '' ||
    work.genres.length === 0 ||
    work.thumbnailUrl.trim() === '' ||
    getPersonalTags(work.personalTags).length === 0
  );
}

function getCoverTone(seed: string) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }

  return String(hash % 6);
}

export function SegmentedChoiceGroup<T extends string>({
  'aria-label': ariaLabel,
  label,
  onChange,
  options,
  value,
}: SegmentedChoiceGroupProps<T>) {
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    optionValue: T,
  ) {
    const currentIndex = options.findIndex((option) => option.value === optionValue);
    const lastIndex = options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(optionValue);
      return;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextValue = options[nextIndex]?.value;
    if (nextValue !== undefined) {
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            `[data-segmented-choice="${ariaLabel}:${nextValue}"]`,
          )
          ?.focus();
      });
    }
  }

  return (
    <Stack gap={6}>
      <Text fw={600} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
        {label}
      </Text>
      <Group
        aria-label={ariaLabel}
        className={cn(css.segmentedChoiceGroup)}
        gap={4}
        role="radiogroup"
        wrap="wrap"
      >
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              aria-checked={isActive}
              className={cx(
                cn(css.segmentedChoice),
                isActive && cn(css.segmentedChoiceActive),
              )}
              data-segmented-choice={`${ariaLabel}:${option.value}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, option.value)}
              role="radio"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span className={cn(css.segmentedChoiceLabel)}>
                {option.label}
              </span>
              {option.description && (
                <span className={cn(css.segmentedChoiceDescription)}>
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </Group>
    </Stack>
  );
}

export function WorkPoster({
  className,
  coverSeed,
  overlay,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: WorkPosterProps & { overlay?: React.ReactNode }) {
  const posterImage = usePosterImageSource(thumbnailUrl, variant);

  return (
    <Box className={cx(cn(css.posterShell), posterVariantClass[variant], className)}>
      {posterImage.src && !posterImage.failed ? (
        <>
          {!posterImage.loaded && (
            <Box aria-hidden="true" className={cn(css.posterImageSkeleton)} />
          )}
          <img
            alt={`${title} 포스터`}
            className={cx(
              cn(css.posterImage),
              posterImage.loaded && cn(css.posterImageLoaded),
            )}
            decoding={posterImage.decoding}
            loading={posterImage.loading}
            onError={posterImage.onError}
            onLoad={posterImage.onLoad}
            src={posterImage.src}
          />
        </>
      ) : (
        <Box
          aria-label={`${title} 포스터 대체 표지`}
          className={cn(css.posterFallback)}
          data-cover-tone={getCoverTone(coverSeed ?? `${typeLabel ?? ''}:${title}`)}
        >
          <Text className={cn(css.posterFallbackType)}>{typeLabel ?? '기록'}</Text>
          <Text className={cn(css.posterFallbackMark)}>
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          <Text className={cn(css.posterFallbackType)}>표지 없음</Text>
        </Box>
      )}
      {overlay}
    </Box>
  );
}

// ── 별점 레이블 맵 (0.5 단위) ────────────────────────────────────────────────
const STAR_LABELS: Record<string, string> = {
  '0.5': '최악', '1.0': '별로', '1.5': '그저 그럼', '2.0': '보통',
  '2.5': '괜찮음', '3.0': '좋음', '3.5': '꽤 좋음', '4.0': '훌륭함',
  '4.5': '거의 완벽', '5.0': '완벽',
};

/** 별점 읽기 전용 표시 — 포스터 카드·목록 행 등에서 사용 */
export function RatingDisplay({ compact = false, value }: RatingDisplayProps) {
  if (value === null) {
    return (
      <Text c="dimmed" size={compact ? 'xs' : 'sm'}>
        미평가
      </Text>
    );
  }

  const filled = Math.floor(value);        // 완전히 채워진 별 수
  const half   = value % 1 >= 0.5 ? 1 : 0; // 반쪽 별 여부
  const empty  = 5 - filled - half;         // 빈 별 수
  const label  = STAR_LABELS[value.toFixed(1)] ?? '';

  return (
    <Group align="center" gap={compact ? 3 : 5} wrap="nowrap">
      {/* 채워진 별 */}
      {Array.from({ length: filled }).map((_, i) => (
        <Text
          key={`f${i}`}
          component="span"
          style={{
            color: 'var(--app-accent-warm, #f59e0b)',
            fontSize: compact ? '0.85rem' : '1rem',
            lineHeight: 1,
          }}
        >
          ★
        </Text>
      ))}
      {/* 반쪽 별 */}
      {half === 1 && (
        <Text
          component="span"
          style={{
            color: 'var(--app-accent-warm, #f59e0b)',
            fontSize: compact ? '0.85rem' : '1rem',
            lineHeight: 1,
            opacity: 0.6,
          }}
        >
          ★
        </Text>
      )}
      {/* 빈 별 */}
      {Array.from({ length: empty }).map((_, i) => (
        <Text
          key={`e${i}`}
          component="span"
          style={{
            color: 'var(--app-border-default)',
            fontSize: compact ? '0.85rem' : '1rem',
            lineHeight: 1,
          }}
        >
          ☆
        </Text>
      ))}
      {/* 숫자 + 레이블 */}
      {!compact && (
        <Text
          c="dimmed"
          fw={600}
          size="xs"
          style={{ fontVariantNumeric: 'tabular-nums', marginLeft: 2 }}
        >
          {value.toFixed(1)}
          {label ? ` · ${label}` : ''}
        </Text>
      )}
      {compact && (
        <Text
          fw={700}
          size="xs"
          style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--app-text-secondary)' }}
        >
          {value.toFixed(1)}
        </Text>
      )}
    </Group>
  );
}

/** 별점 입력 컴포넌트 — Mantine Rating 기반 0.5 단위 선택 */
export interface StarRatingInputProps {
  label?: string;
  onChange: (value: number | null) => void;
  value: number | null;
}

function RatingStarIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.6 14.9 8.7l6.7.9-4.9 4.7 1.2 6.7L12 17.8 6.1 21l1.2-6.7-4.9-4.7 6.7-.9L12 2.6Z" />
    </svg>
  );
}

export function StarRatingInput({ label = '별점', onChange, value }: StarRatingInputProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;
  const displayLabel =
    displayValue > 0
      ? `${displayValue.toFixed(1)} · ${STAR_LABELS[displayValue.toFixed(1)] ?? '평가'}`
      : '별점을 선택하세요';
  const semanticLabel =
    value === null ? '평가 안 함' : `${value.toFixed(1)}점`;

  function getPointerRating(event: PointerEvent<HTMLButtonElement>) {
    const starElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-rating-star-index]'),
    );
    const fallbackRect = event.currentTarget.getBoundingClientRect();

    for (const starElement of starElements) {
      const rect = starElement.getBoundingClientRect();

      if (event.clientX < rect.left || event.clientX > rect.right) {
        continue;
      }

      const starIndex = Number(starElement.dataset.ratingStarIndex ?? 0);
      const isRightHalf = event.clientX >= rect.left + rect.width / 2;

      return starIndex + (isRightHalf ? 1 : 0.5);
    }

    if (event.clientX <= fallbackRect.left) return 0.5;
    if (event.clientX >= fallbackRect.right) return 5;

    return value ?? 0.5;
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    setHoverValue(getPointerRating(event));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(getPointerRating(event));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentValue = value ?? 0;

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(5, currentValue + 0.5));
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextValue = Math.max(0, currentValue - 0.5);
      onChange(nextValue === 0 ? null : nextValue);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      onChange(null);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      onChange(5);
    }
  }

  return (
    <Box className={cn(css.starRatingInput)}>
      <Group align="center" justify="space-between" wrap="nowrap">
        <Text c="var(--app-text-secondary)" fw={750} size="sm">
          {label}
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Text className={cn(css.starRatingScore)}>
            {displayLabel}
          </Text>
          {value !== null && (
            <ActionIcon
              aria-label="별점 초기화"
              className={cn(css.starRatingReset)}
              onClick={() => onChange(null)}
              size="sm"
              variant="subtle"
            >
              <Text size="xs">✕</Text>
            </ActionIcon>
          )}
        </Group>
      </Group>

      <button
        aria-label={label}
        aria-valuemax={5}
        aria-valuemin={0}
        aria-valuenow={value ?? 0}
        aria-valuetext={semanticLabel}
        className={cn(css.starRatingControl)}
        onBlur={() => setHoverValue(null)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setHoverValue(null)}
        onPointerMove={handlePointerMove}
        role="slider"
        type="button"
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const fillPercent = Math.min(100, Math.max(0, (displayValue - index) * 100));

          return (
            <span
              aria-hidden="true"
              className={cn(css.starRatingSymbol)}
              data-active={fillPercent > 0 ? 'true' : undefined}
              data-rating-star-index={index}
              key={index}
            >
              <RatingStarIcon className={cn(css.starRatingEmptyIcon)} />
              <span
                className={cn(css.starRatingFill)}
                style={{ width: `${fillPercent}%` }}
              >
                <RatingStarIcon className={cn(css.starRatingFillIcon)} />
              </span>
            </span>
          );
        })}
      </button>
    </Box>
  );
}

export function ProgressDisplay({ work }: ProgressDisplayProps) {
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);

  if (!progressLabel) {
    return (
      <Text c="dimmed" size="sm">
        진행 기록 없음
      </Text>
    );
  }

  return (
    <Stack className={cn(css.progressTrack)} gap={5}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text c="dimmed" lineClamp={1} size="sm">
          {progressLabel}
        </Text>
        {progressPercent !== null && (
          <Text c="dimmed" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {progressPercent}%
          </Text>
        )}
      </Group>
      {progressPercent !== null && (
        <Progress
          aria-label={`${work.title} 상세 진행도 ${progressPercent}%`}
          color="archive"
          radius="xl"
          size={5}
          value={progressPercent}
        />
      )}
    </Stack>
  );
}

type AppBadgeToneValue = 'accent' | 'danger' | 'default' | 'error' | 'info' | 'muted' | 'success' | 'warning';

function getStatusBadgeTone(status: string): AppBadgeToneValue {
  switch (status) {
    case 'in_progress': return 'info';
    case 'completed':   return 'success';
    case 'planned':     return 'muted';
    case 'dropped':     return 'danger';
    default:            return 'default';
  }
}

export function WorkPosterCard({ isUpdating = false, work }: WorkPosterCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const needsCuration = needsPosterCuration(work);

  return (
    <Link
      aria-label={`${work.title} 상세 보기`}
      className={cn(css.posterCardLink)}
      to={`/works/${work.id}`}
    >
      <Paper className={cn(css.posterCardSurface)} withBorder>
        {work.favorite && (
          <ActionIcon
            aria-label={`${work.title} 즐겨찾기`}
            className={cn(css.favoriteMark)}
            component="span"
            size="sm"
            variant="default"
          >
            ★
          </ActionIcon>
        )}
        <WorkPoster
          coverSeed={work.id}
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="grid"
        />
        {needsCuration && (
          <Box
            aria-hidden="true"
            className={cn(css.posterCurationMarker)}
            title="정리 필요"
          />
        )}
        <Stack className={cn(css.posterCardBody)} gap={5}>
          <Title className={cn(css.posterCardTitle)} lineClamp={2} order={3} size="h4">
            {work.title}
          </Title>
          <Text
            className={cn(css.posterAuthorLine)}
            lineClamp={1}
            size="sm"
          >
            {getPosterAuthorLine(work)}
          </Text>
          <Text
            c="dimmed"
            className={cn(css.posterMetaLine)}
            lineClamp={1}
            size="sm"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {getPrimaryMetaLine(work)}
          </Text>
          {isUpdating && <Text c="var(--app-accent-primary)" fw={800} size="xs">저장 중</Text>}
        </Stack>
      </Paper>
    </Link>
  );
}

export function WorkRowCard({ isUpdating = false, work }: WorkRowCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Link className={cn(css.rowCard)} to={`/works/${work.id}`}>
      <Paper className={cn(css.rowSurface)} withBorder>
        <Group align="center" gap="md" wrap="nowrap">
          <WorkPoster
            coverSeed={work.id}
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />
          <Stack flex={1} gap={6} miw={0}>
            {/* 메타: 유형 배지 + 상태 배지 */}
            <Group gap={6} wrap="nowrap">
              <AppBadge tone="muted">{typeLabel}</AppBadge>
              <AppBadge tone={getStatusBadgeTone(work.status)}>{getWorkStatusLabel(work.status)}</AppBadge>
              {isUpdating && <AppBadge tone="accent">저장 중</AppBadge>}
            </Group>
            <Title lineClamp={1} order={3} size="h4">
              {work.title}
            </Title>
            <Group align="center" gap="md" wrap="nowrap">
              <Box flex={1} miw={0}>
                <ProgressDisplay work={work} />
              </Box>
              <RatingDisplay compact value={work.rating} />
            </Group>
          </Stack>
        </Group>
      </Paper>
    </Link>
  );
}

export function WorkShelf({ empty, title, works }: WorkShelfProps) {
  if (works.length === 0) {
    return empty ?? null;
  }

  return (
    <Stack gap="md">
      {title}
      <Box className={cn(css.shelf)}>
        {works.map((work) => (
          <WorkPosterCard key={work.id} work={work} />
        ))}
      </Box>
    </Stack>
  );
}

export function ArchiveStarterShelf() {
  const starterCovers = [
    { title: '첫 기록', typeLabel: '소설' },
    { title: '이어보기', typeLabel: '애니' },
    { title: '다시 보고 싶은 장면', typeLabel: '영화' },
    { title: '한줄 감상', typeLabel: '만화' },
  ];

  return (
    <Stack className={cn(css.starterShelf)} gap="md">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={4}>
          <Text
            c="var(--app-accent-primary)"
            fw={800}
            size="xs"
            tt="uppercase"
            style={{ letterSpacing: '0.06em' }}
          >
            시작하기
          </Text>
          <Title order={2}>처음 채울 선반</Title>
          <Text c="dimmed" size="sm">
            제목 하나만 남겨도 포스터처럼 정리됩니다.
          </Text>
        </Stack>
        <AppLinkButton to="/works/new" tone="primary">
          첫 작품 기록
        </AppLinkButton>
      </Group>
      <Box className={cn(css.starterCovers)} aria-hidden="true">
        {starterCovers.map((cover, index) => (
          <WorkPoster
            coverSeed={`starter:${index}`}
            key={cover.title}
            title={cover.title}
            typeLabel={cover.typeLabel}
            variant="grid"
          />
        ))}
      </Box>
    </Stack>
  );
}

export function ArchiveHero({
  actions,
  children,
  description,
  eyebrow,
  title,
  variant = 'default',
  visual,
}: ArchiveHeroProps) {
  return (
    <Paper
      className={cx(
        cn(css.hero),
        variant === 'compact' && cn(css.heroCompact),
        variant === 'landing' && cn(css.heroLanding),
      )}
      withBorder
    >
      <Stack className={cn(css.heroContent)} gap="xl">
        {visual ? (
          <Box className={cn(css.heroLayout)}>
            <Stack className={cn(css.heroTextColumn)} gap="lg">
              <Stack gap="sm">
                {eyebrow && (
                  <Text
                    fw={700}
                    size="xs"
                    tt="uppercase"
                    style={{
                      letterSpacing: '0.10em',
                      color: 'var(--app-accent-primary)',
                      fontSize: 'var(--app-type-meta)',
                    }}
                  >
                    {eyebrow}
                  </Text>
                )}
                <Title
                  className={cn(css.heroTitle)}
                  order={1}
                  style={{ letterSpacing: '-0.03em', lineHeight: 1.15 }}
                >
                  {title}
                </Title>
                <Text
                  size="lg"
                  style={{ color: 'var(--app-text-secondary)', lineHeight: 1.6 }}
                >
                  {description}
                </Text>
              </Stack>
              {children}
              {actions && <Group gap="sm" wrap="wrap">{actions}</Group>}
            </Stack>
            <Box className={cn(css.heroVisual)}>{visual}</Box>
          </Box>
        ) : (
          <>
            <Group align="flex-start" justify="space-between" wrap="wrap">
              <Stack gap="sm" maw={760}>
            {eyebrow && (
              <Text
                fw={700}
                size="xs"
                tt="uppercase"
                style={{
                  letterSpacing: '0.10em',
                  color: 'var(--app-accent-primary)',
                  fontSize: 'var(--app-type-meta)',
                }}
              >
                {eyebrow}
              </Text>
            )}
            <Title
              className={cn(css.heroTitle)}
              order={1}
              style={{ letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              {title}
            </Title>
            <Text
              size="lg"
              style={{ color: 'var(--app-text-secondary)', lineHeight: 1.6 }}
            >
              {description}
            </Text>
              </Stack>
              {actions}
            </Group>
            {children}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function FilterPillGroup<T extends string>({
  'aria-label': ariaLabel,
  onChange,
  options,
  value,
}: FilterPillGroupProps<T>) {
  return (
    <Group
      aria-label={ariaLabel}
      gap={4}
      role="group"
      wrap="wrap"
      style={{
        padding: '3px',
        background: 'var(--app-surface-subtle)',
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid var(--app-border-subtle)',
        display: 'inline-flex',
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Button
            aria-pressed={isActive}
            className={cx(cn(css.filterPill), isActive && cn(css.filterPillActive))}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="compact-sm"
            variant="default"
            style={{
              borderRadius: 'calc(var(--mantine-radius-md) - 2px)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 'var(--app-type-body)',
              letterSpacing: '0',
              transition: [
                'background var(--wa-motion-fast, 150ms)',
                'color var(--wa-motion-fast, 150ms)',
                'box-shadow var(--wa-motion-fast, 150ms)',
              ].join(', '),
              background: isActive ? 'var(--app-surface-card)' : 'transparent',
              border: isActive ? '1px solid var(--app-border-default)' : '1px solid transparent',
              boxShadow: isActive ? 'var(--wa-shadow-card)' : 'none',
              color: isActive ? 'var(--app-text-primary)' : 'var(--app-text-secondary)',
            }}
          >
            {option.count !== undefined
              ? `${option.label} ${option.count}`
              : option.label}
          </Button>
        );
      })}
    </Group>
  );
}

export function ArchiveSearchBar({
  'aria-label': ariaLabel,
  inputRef,
  onChange,
  onSubmit,
  placeholder,
  value,
}: ArchiveSearchBarProps) {
  return (
    <TextInput
      aria-label={ariaLabel}
      className={cn(css.searchInput)}
      flex={1}
      miw={0}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onSubmit?.();
        }
      }}
      placeholder={placeholder}
      ref={inputRef}
      value={value}
    />
  );
}

export function QuickProgressControl({
  disabled = false,
  onSave,
  work,
}: QuickProgressControlProps) {
  const defaultUnit =
    work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);
  const [current, setCurrent] = useState<number | null>(
    work.progressCurrent ?? null,
  );
  const [total, setTotal] = useState<number | null>(work.progressTotal ?? null);
  const [lastLabel, setLastLabel] = useState(work.lastConsumedLabel ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrent(work.progressCurrent ?? null);
    setTotal(work.progressTotal ?? null);
    setLastLabel(work.lastConsumedLabel ?? '');
  }, [work.id, work.lastConsumedLabel, work.progressCurrent, work.progressTotal]);

  if (!defaultUnit) {
    return null;
  }

  const hasChanges =
    current !== (work.progressCurrent ?? null) ||
    total !== (work.progressTotal ?? null) ||
    lastLabel !== (work.lastConsumedLabel ?? '');
  const hasInvalidProgress =
    current !== null && total !== null && current > total;
  const unitLabel = progressUnitLabels[defaultUnit];
  const currentLabel = progressCurrentLabels[defaultUnit];
  const totalLabel = progressTotalLabels[defaultUnit];
  const lastPositionLabel = lastPositionLabels[defaultUnit];

  async function handleSave() {
    if (!defaultUnit) return;

    try {
      setIsSaving(true);
      await onSave({
        lastConsumedLabel: lastLabel,
        progressCurrent: current,
        progressTotal: total,
        progressUnit: defaultUnit,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Paper className={cn(css.quickPanel)} radius="lg" withBorder>
      <Stack gap="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={currentLabel}
            min={0}
            onChange={(value) => setCurrent(coerceNumberInputValue(value))}
            value={current ?? ''}
            w={120}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={totalLabel}
            min={0}
            onChange={(value) => setTotal(coerceNumberInputValue(value))}
            value={total ?? ''}
            w={120}
          />
          <AppButton
            disabled={disabled || isSaving}
            onClick={() => setCurrent((value) => (value === null ? 1 : value + 1))}
            tone="secondary"
            type="button"
          >
            +1{unitLabel}
          </AppButton>
          <AppButton
            disabled={disabled || isSaving || total === null}
            onClick={() => setCurrent(total)}
            tone="secondary"
            type="button"
          >
            전체 분량까지 기록
          </AppButton>
        </Group>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            disabled={disabled || isSaving}
            flex={1}
            label={lastPositionLabel}
            miw={220}
            onChange={(event) => setLastLabel(event.currentTarget.value)}
            placeholder={`예: ${current ?? 18}${unitLabel}까지`}
            value={lastLabel}
          />
          <AppButton
            disabled={disabled || isSaving || !hasChanges || hasInvalidProgress}
            loading={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            기록 저장
          </AppButton>
        </Group>
        {hasInvalidProgress && (
          <Text c="red" size="sm">
            현재 진행량이 전체보다 클 수 없습니다.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

export function ReviewNoteCard({
  emptyLabel = '아직 남긴 기록이 없습니다.',
  label,
  value,
}: ReviewNoteCardProps) {
  const isEmpty = typeof value === 'string' && value.trim() === '';

  return (
    <Paper className={cn(css.noteCard)} withBorder>
      <Stack gap="sm">
        <Text c="dimmed" fw={800} size="sm">
          {label}
        </Text>
        {isEmpty ? (
          <Text c="dimmed" lh={1.8}>{emptyLabel}</Text>
        ) : (
          <Text lh={1.8}>{value}</Text>
        )}
      </Stack>
    </Paper>
  );
}

function EmptyStateIllustration() {
  return (
    <svg
      aria-hidden="true"
      className={cn(css.emptyIllustration)}
      fill="none"
      height="120"
      viewBox="0 0 160 120"
      width="160"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 배경 원 */}
      <circle cx="80" cy="60" fill="currentColor" opacity="0.04" r="56" />
      <circle cx="80" cy="60" fill="currentColor" opacity="0.04" r="40" />
      {/* 포스터 더미 1 (뒤) */}
      <rect
        className={cn(css.emptyFloat2)}
        fill="currentColor"
        height="64"
        opacity="0.10"
        rx="6"
        transform="rotate(-8 52 30)"
        width="44"
        x="32"
        y="28"
      />
      {/* 포스터 더미 2 (뒤) */}
      <rect
        className={cn(css.emptyFloat3)}
        fill="currentColor"
        height="64"
        opacity="0.10"
        rx="6"
        transform="rotate(6 84 28)"
        width="44"
        x="84"
        y="28"
      />
      {/* 메인 포스터 */}
      <rect
        className={cn(css.emptyFloat1)}
        fill="currentColor"
        height="72"
        opacity="0.18"
        rx="8"
        width="48"
        x="56"
        y="24"
      />
      {/* 포스터 내 제목 자리 */}
      <rect fill="currentColor" height="4" opacity="0.25" rx="2" width="30" x="65" y="56" />
      <rect fill="currentColor" height="3" opacity="0.15" rx="1.5" width="20" x="70" y="64" />
      {/* 반짝이는 별 */}
      <circle className={cn(css.emptySparkle1)} cx="28" cy="22" fill="currentColor" opacity="0.35" r="3" />
      <circle className={cn(css.emptySparkle2)} cx="132" cy="32" fill="currentColor" opacity="0.25" r="2" />
      <circle className={cn(css.emptySparkle1)} cx="140" cy="80" fill="currentColor" opacity="0.20" r="2.5" />
      <circle className={cn(css.emptySparkle2)} cx="20" cy="88" fill="currentColor" opacity="0.30" r="2" />
      {/* 하단 선반 라인 */}
      <rect fill="currentColor" height="3" opacity="0.12" rx="1.5" width="120" x="20" y="100" />
    </svg>
  );
}

export function ArchiveEmptyState({
  actions,
  description,
  eyebrow = '빈 선반',
  title,
}: ArchiveEmptyStateProps) {
  return (
    <Stack align="flex-start" className={cn(css.emptyState)} gap="md">
      <EmptyStateIllustration />
      <AppBadge tone="accent">{eyebrow}</AppBadge>
      <Title order={2}>{title}</Title>
      <Text c="dimmed" maw="58ch">{description}</Text>
      {actions && <Group gap="sm" wrap="wrap">{actions}</Group>}
    </Stack>
  );
}

export function ArchiveSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SimpleGrid
      aria-busy="true"
      aria-live="polite"
      className={cn(css.skeletonGrid)}
      cols={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
      spacing={{ base: 'md', md: 'xl' }}
      verticalSpacing="xl"
    >
      {Array.from({ length: count }, (_, index) => (
        <Stack gap="sm" key={index}>
          <Skeleton height={220} radius="lg" />
          <Skeleton height={14} radius="sm" width="80%" />
          <Skeleton height={10} radius="sm" width="55%" />
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export function WorkUpdatedMeta({ work }: { work: WorkRecord }) {
  return (
    <Text c="dimmed" lineClamp={1} size="sm">
      마지막 감상 {formatWorkDate(work.lastConsumedAt)}
    </Text>
  );
}
