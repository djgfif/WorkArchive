import { Box, Group, Stack, Text } from '@mantine/core';
import type { WorkType } from '@work-archive/shared-types';

import { AppButton } from '@shared/components/AppPrimitives';
import { IconX } from './WorksToolbarIcons';
import styles from './ArchiveComponents.module.css';
import type { WorksCollectionScope } from '../services/works.service';
import type { WorksListQuery } from '../utils/query-works';
import {
  buildMediaTypeOptions,
  type WorksToolbarFilterChip,
} from '../utils/works-toolbar-state';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface MediaTypeFilterProps {
  onChange: (type: WorksListQuery['type']) => void;
  totalCount: number;
  typeCounts: Record<WorkType, number>;
  value: WorksListQuery['type'];
}

export function MediaTypeFilter({
  onChange,
  totalCount,
  typeCounts,
  value,
}: MediaTypeFilterProps) {
  const options = buildMediaTypeOptions({
    activeValue: value,
    totalCount,
    typeCounts,
  });

  return (
    <Box className={cn(css.mediaTypeFilter)}>
      <Box aria-label="매체 유형으로 빠르게 좁히기" role="group">
        <Box className={cn(css.mediaTypeOptions)}>
          {options.map((option) => {
            const isActive = option.value === value;

            return (
              <Box
                aria-label={option.label}
                aria-pressed={isActive}
                className={cn(css.mediaTypeOption)}
                component="button"
                data-active={isActive ? 'true' : 'false'}
                data-empty={option.count === 0 ? 'true' : 'false'}
                key={option.value}
                onClick={() => onChange(option.value)}
                type="button"
              >
                <Text
                  className={cn(css.mediaTypeOptionLabel)}
                  fw={800}
                  size="xs"
                >
                  {option.label}
                </Text>
                <Text
                  aria-hidden="true"
                  className={cn(css.mediaTypeOptionCount)}
                  fw={800}
                  size="xs"
                >
                  {option.count}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

interface ActiveFilterChipsProps {
  chips: WorksToolbarFilterChip[];
  onClearFilters: () => void;
}

export function ActiveFilterChips({
  chips,
  onClearFilters,
}: ActiveFilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <Group
      aria-label="적용된 필터"
      className={cn(css.activeFilterGroup)}
      gap="xs"
      role="group"
      wrap="wrap"
    >
      {chips.map((chip, index) => (
        <Box
          className={cn(css.activeFilterChip)}
          data-mobile-overflow={index >= 3 ? 'true' : 'false'}
          key={chip.label}
        >
          {chip.label}
          <Box
            aria-label={`${chip.label} 필터 제거`}
            className={cn(css.activeFilterRemove)}
            component="button"
            onClick={chip.onRemove}
            type="button"
          >
            <IconX />
          </Box>
        </Box>
      ))}
      {chips.length > 3 && (
        <Box
          className={`${cn(css.activeFilterChip)} ${cn(
            css.activeFilterMoreChip,
          )}`}
        >
          필터 {chips.length - 3}개 더 있음
        </Box>
      )}
      <Box
        className={cn(css.chipResetButton)}
        component="button"
        onClick={onClearFilters}
        type="button"
      >
        모두 지우기
      </Box>
    </Group>
  );
}

interface TrashScopeBarProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCollectionScopeChange: (scope: WorksCollectionScope) => void;
}

export function TrashScopeBar({
  hasActiveFilters,
  onClearFilters,
  onCollectionScopeChange,
}: TrashScopeBarProps) {
  return (
    <Box className={cn(css.trashScopeBar)}>
      <Stack gap={2} miw={0}>
        <Text c="var(--app-text-primary)" fw={800} size="sm">
          복구가 기본 작업입니다.
        </Text>
        <Text c="var(--app-text-muted)" size="xs">
          삭제한 작품은 서재에서 숨겨진 상태입니다. 복구하면 원래 서재로
          돌아갑니다.
        </Text>
      </Stack>
      <Group gap="xs" justify="flex-end" wrap="wrap">
        {hasActiveFilters && (
          <AppButton
            onClick={onClearFilters}
            size="compact-sm"
            tone="secondary"
            type="button"
          >
            필터 초기화
          </AppButton>
        )}
        <AppButton
          onClick={() => onCollectionScopeChange('active')}
          size="compact-sm"
          tone="quiet"
          type="button"
        >
          서재 보기
        </AppButton>
      </Group>
    </Box>
  );
}
