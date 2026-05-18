import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { AppBadge, AppButton } from '../../../shared/components/AppPrimitives';
import {
  formatWorkDate,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from './archive-display';
import styles from './ArchiveComponents.module.css';

type PosterVariant = 'card' | 'detail' | 'form' | 'grid' | 'row';

const css = (className: string | undefined) => className ?? '';

const posterVariantClass: Record<PosterVariant, string> = {
  card: css(styles.posterCard),
  detail: css(styles.posterDetail),
  form: css(styles.posterForm),
  grid: css(styles.posterGrid),
  row: css(styles.posterRow),
};

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

interface WorkPosterProps {
  className?: string;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: PosterVariant;
}

interface WorkPosterCardProps {
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

interface ArchiveSearchBarProps {
  'aria-label': string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
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

export function WorkPoster({
  className,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: WorkPosterProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailUrl]);

  return (
    <Box
      className={cx(
        css(styles.posterShell),
        posterVariantClass[variant],
        className,
      )}
    >
      {thumbnailUrl && !imageFailed ? (
        <img
          alt={`${title} 포스터`}
          className={css(styles.posterImage)}
          onError={() => setImageFailed(true)}
          src={thumbnailUrl}
        />
      ) : (
        <Box className={css(styles.posterFallback)}>
          <Text className={css(styles.posterFallbackType)}>{typeLabel ?? 'Archive'}</Text>
          <Text className={css(styles.posterFallbackMark)}>
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          <Text className={css(styles.posterFallbackType)}>Work Archive</Text>
        </Box>
      )}
    </Box>
  );
}

export function RatingDisplay({ compact = false, value }: RatingDisplayProps) {
  if (value === null) {
    return (
      <Text c="dimmed" size={compact ? 'xs' : 'sm'}>
        미평가
      </Text>
    );
  }

  return (
    <Group gap={5} wrap="nowrap">
      <Text c="ember.3" fw={800} size={compact ? 'sm' : 'md'}>
        ★
      </Text>
      <Text fw={700} size={compact ? 'xs' : 'sm'}>
        {value.toFixed(1)}
      </Text>
    </Group>
  );
}

export function ProgressDisplay({ work }: ProgressDisplayProps) {
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);

  if (!progressLabel) {
    return (
      <Text c="dimmed" size="sm">
        진행도 없음
      </Text>
    );
  }

  return (
    <Stack className={css(styles.progressTrack)} gap={5}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text c="dimmed" lineClamp={1} size="sm">
          {progressLabel}
        </Text>
        {progressPercent !== null && (
          <Text c="dimmed" size="xs">
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

export function WorkPosterCard({ work }: WorkPosterCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Link className={css(styles.posterCardLink)} to={`/works/${work.id}`}>
      <Paper className={css(styles.posterCardSurface)} withBorder>
        <WorkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="grid"
        />
        <Stack className={css(styles.posterCardBody)} gap={6}>
          <Title lineClamp={2} order={3} size="h4">
            {work.title}
          </Title>
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Text c="dimmed" lineClamp={1} size="sm">
              {getWorkStatusLabel(work.status)}
            </Text>
            <Text c={work.rating === null ? 'dimmed' : 'ember.3'} fw={700} size="sm">
              {work.rating === null ? '미평가' : `별점 ${work.rating.toFixed(1)}`}
            </Text>
          </Group>
        </Stack>
      </Paper>
    </Link>
  );
}

export function WorkRowCard({ isUpdating = false, work }: WorkRowCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Link className={css(styles.rowCard)} to={`/works/${work.id}`}>
      <Paper className={css(styles.rowSurface)} withBorder>
        <Group align="center" gap="md" wrap="nowrap">
          <WorkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />
          <Stack flex={1} gap={6} miw={0}>
            <Group gap="xs" wrap="nowrap">
              <Text c="dimmed" lineClamp={1} size="xs">
                {typeLabel}
              </Text>
              <Text c="dimmed" size="xs">
                /
              </Text>
              <Text c="dimmed" lineClamp={1} size="xs">
                {getWorkStatusLabel(work.status)}
              </Text>
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
            {work.shortReview.trim() && (
              <Text c="dimmed" lineClamp={1} size="sm">
                {work.shortReview}
              </Text>
            )}
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
      <Box className={css(styles.shelf)}>
        {works.map((work) => (
          <WorkPosterCard key={work.id} work={work} />
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
}: ArchiveHeroProps) {
  return (
    <Paper className={css(styles.hero)} withBorder>
      <Stack className={css(styles.heroContent)} gap="xl">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap="sm" maw={720}>
            {eyebrow && <Text className={css(styles.eyebrow)}>{eyebrow}</Text>}
            <Title order={1}>{title}</Title>
            <Text c="dimmed" size="lg">
              {description}
            </Text>
          </Stack>
          {actions}
        </Group>
        {children}
      </Stack>
    </Paper>
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

  async function handleSave() {
    if (!defaultUnit) {
      return;
    }

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
    <Paper p="md" radius="lg" withBorder>
      <Stack gap="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={`현재 ${unitLabel}`}
            min={0}
            onChange={(value) => setCurrent(coerceNumberInputValue(value))}
            value={current ?? ''}
            w={120}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={`전체 ${unitLabel}`}
            min={0}
            onChange={(value) => setTotal(coerceNumberInputValue(value))}
            value={total ?? ''}
            w={120}
          />
          <AppButton
            disabled={disabled || isSaving}
            onClick={() =>
              setCurrent((value) => (value === null ? 1 : value + 1))
            }
            tone="secondary"
            type="button"
          >
            +1
          </AppButton>
          <AppButton
            disabled={disabled || isSaving || total === null}
            onClick={() => setCurrent(total)}
            tone="secondary"
            type="button"
          >
            완료 처리
          </AppButton>
        </Group>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            disabled={disabled || isSaving}
            flex={1}
            label="마지막 위치"
            miw={220}
            onChange={(event) => setLastLabel(event.currentTarget.value)}
            placeholder={`예: ${current ?? 18}${unitLabel}`}
            value={lastLabel}
          />
          <AppButton
            disabled={
              disabled || isSaving || !hasChanges || hasInvalidProgress
            }
            loading={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            진행도 저장
          </AppButton>
        </Group>
        {hasInvalidProgress && (
          <Text c="red" size="sm">
            현재 진행도가 전체보다 클 수 없습니다.
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
    <Paper className={css(styles.noteCard)} withBorder>
      <Stack gap="sm">
        <Text c="dimmed" fw={700} size="sm">
          {label}
        </Text>
        {isEmpty ? (
          <Text c="dimmed" lh={1.8}>
            {emptyLabel}
          </Text>
        ) : (
          <Text lh={1.8}>{value}</Text>
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
    <Group aria-label={ariaLabel} gap="xs" role="group" wrap="wrap">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Button
            aria-label={option.label}
            className={cx(
              css(styles.filterPill),
              isActive && css(styles.filterPillActive),
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="sm"
            variant="default"
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
  onChange,
  onSubmit,
  placeholder,
  value,
}: ArchiveSearchBarProps) {
  return (
    <TextInput
      aria-label={ariaLabel}
      className={css(styles.searchInput)}
      flex={1}
      miw={0}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onSubmit?.();
        }
      }}
      placeholder={placeholder}
      value={value}
    />
  );
}

export function WorkUpdatedMeta({ work }: { work: WorkRecord }) {
  return (
    <Text c="dimmed" lineClamp={1} size="sm">
      마지막 감상 {formatWorkDate(work.lastConsumedAt)}
    </Text>
  );
}
