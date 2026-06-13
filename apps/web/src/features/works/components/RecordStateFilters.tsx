import type { ReactNode } from 'react';
import { Group, Stack } from '@mantine/core';
import type { WorkStatus } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import styles from './ArchiveComponents.module.css';
import type { WorksListQuery } from '../utils/query-works';
import {
  ratingPresetOptions,
  smartFilterOptions,
} from '../utils/works-toolbar-state';
import { cn, cx } from '@shared/utils/class-names';

const css = styles;

/* 감상 상태별 의미 색 — 점으로 빠르게 구분 */
const statusDotColor: Record<WorkStatus, string> = {
  planned: 'var(--app-text-muted)',
  in_progress: 'var(--app-accent-secondary)',
  on_hold: 'var(--app-state-warning)',
  completed: 'var(--app-state-success)',
  dropped: 'var(--app-accent-rose)',
};

interface StatusOption {
  count?: number;
  label: string;
  value: 'all' | WorkStatus;
}

interface StateChipProps {
  active: boolean;
  count?: number | undefined;
  dotColor?: string | undefined;
  label: string;
  leading?: ReactNode | undefined;
  onClick: () => void;
}

function StateChip({
  active,
  count,
  dotColor,
  label,
  leading,
  onClick,
}: StateChipProps) {
  return (
    <button
      aria-pressed={active}
      className={cx(cn(css.filterChip), active && cn(css.filterChipActive))}
      onClick={onClick}
      type="button"
    >
      {dotColor ? (
        <span
          className={cn(css.filterChipDot)}
          style={{ background: dotColor }}
        />
      ) : null}
      {leading}
      <span>{label}</span>
      {count !== undefined ? (
        <span className={cn(css.filterChipCount)}>{count}</span>
      ) : null}
    </button>
  );
}

function StarGlyph({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cx(
        cn(css.filterChipStar),
        muted && cn(css.filterChipStarMuted),
      )}
      height={13}
      viewBox="0 0 24 24"
      width={13}
    >
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.5l-5.8 3.05 1.1-6.47-4.7-4.58 6.5-.95z"
        fill={muted ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={muted ? 1.6 : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmartIcon({
  name,
}: {
  name: 'favorites' | 'needsCuration' | 'unrated';
}) {
  const common = {
    'aria-hidden': true as const,
    className: cn(css.filterChipIcon),
    fill: 'none' as const,
    height: 13,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
    viewBox: '0 0 24 24',
    width: 13,
  };
  if (name === 'favorites') {
    return (
      <svg {...common}>
        <path d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.4 2 7.6 2 4.9 4.1 3 6.7 3c1.5 0 2.95.7 3.8 1.8l1.5 1.95L13.5 4.8C14.35 3.7 15.8 3 17.3 3 19.9 3 22 4.9 22 7.6c0 3.8-3.4 6.9-8.55 11.58z" />
      </svg>
    );
  }
  if (name === 'needsCuration') {
    return (
      <svg {...common}>
        <path d="M4 21V4M4 4h13l-2.2 3.6L17 11H4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 4.5l2.4 4.9 5.4.78-3.9 3.8.92 5.37L12 16.9l-4.83 2.45.92-5.37-3.9-3.8 5.4-.78z" />
    </svg>
  );
}

interface RecordStateFiltersProps {
  onQueryChange: (query: WorksListQuery) => void;
  query: WorksListQuery;
  statusOptions: StatusOption[];
}

export function RecordStateFilters({
  onQueryChange,
  query,
  statusOptions,
}: RecordStateFiltersProps) {
  const { t } = useAppTranslation();
  const ratingValue = query.ratingPreset ?? 'all';
  const smartValue = query.smartFilter ?? 'all';

  return (
    <Stack gap="md">
      <div className={cn(css.recordStateBlock)}>
        <span className={cn(css.recordStateLabel)}>
          {t('works.list.recordStatusLabel')}
        </span>
        <Group
          aria-label={t('works.list.recordStatusAria')}
          gap={6}
          role="group"
          wrap="wrap"
        >
          {statusOptions.map((option) => (
            <StateChip
              active={query.status === option.value}
              count={option.count}
              dotColor={
                option.value === 'all'
                  ? undefined
                  : statusDotColor[option.value]
              }
              key={option.value}
              label={option.label}
              onClick={() => onQueryChange({ ...query, status: option.value })}
            />
          ))}
        </Group>
      </div>

      <div className={cn(css.recordStateBlock)}>
        <span className={cn(css.recordStateLabel)}>
          {t('works.form.ratingLabel')}
        </span>
        <Group
          aria-label={t('works.list.ratingFilterAria')}
          gap={6}
          role="group"
          wrap="wrap"
        >
          {ratingPresetOptions.map((option) => (
            <StateChip
              active={ratingValue === option.value}
              key={option.value}
              label={option.label}
              leading={
                option.value === 'all' ? undefined : (
                  <StarGlyph muted={option.value === 'unrated'} />
                )
              }
              onClick={() =>
                onQueryChange({
                  ...query,
                  rating: null,
                  ratingPreset: option.value,
                })
              }
            />
          ))}
        </Group>
      </div>

      <div className={cn(css.recordStateBlock)}>
        <span className={cn(css.recordStateLabel)}>
          {t('works.list.smartFilterLabel')}
        </span>
        <Group
          aria-label={t('works.list.smartFilterAria')}
          gap={6}
          role="group"
          wrap="wrap"
        >
          {smartFilterOptions.map((option) => (
            <StateChip
              active={smartValue === option.value}
              key={option.value}
              label={option.label}
              leading={
                option.value === 'all' ? undefined : (
                  <SmartIcon name={option.value} />
                )
              }
              onClick={() =>
                onQueryChange({ ...query, smartFilter: option.value })
              }
            />
          ))}
        </Group>
      </div>
    </Stack>
  );
}
