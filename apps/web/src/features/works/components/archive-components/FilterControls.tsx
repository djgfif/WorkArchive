import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import { cn, css, cx } from './styles';

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
  /**
   * `segmented` (default): 적고 순서가 있는 집합 — 한 박스 안의 세그먼트.
   * `chips`: 많고 개방적인 집합(장르·작가 등) — 자유 흐름 칩 세트.
   */
  variant?: 'chips' | 'segmented';
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
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
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

export function FilterPillGroup<T extends string>({
  'aria-label': ariaLabel,
  onChange,
  options,
  value,
  variant = 'segmented',
}: FilterPillGroupProps<T>) {
  if (variant === 'chips') {
    return (
      <Group aria-label={ariaLabel} gap={6} role="group" wrap="wrap">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              aria-pressed={isActive}
              className={cx(cn(css.filterChip), isActive && cn(css.filterChipActive))}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span className={cn(css.filterChipCount)}>{option.count}</span>
              )}
            </button>
          );
        })}
      </Group>
    );
  }

  return (
    <Group
      aria-label={ariaLabel}
      gap={4}
      role="group"
      wrap="wrap"
      style={{
        background: 'var(--app-surface-subtle)',
        border: '1px solid var(--app-border-subtle)',
        borderRadius: 'var(--mantine-radius-md)',
        display: 'inline-flex',
        padding: '3px',
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
              background: isActive ? 'var(--app-surface-card)' : 'transparent',
              border: isActive
                ? '1px solid var(--app-border-default)'
                : '1px solid transparent',
              borderRadius: 'calc(var(--mantine-radius-md) - 2px)',
              boxShadow: isActive ? 'var(--wa-shadow-card)' : 'none',
              color: isActive
                ? 'var(--app-text-primary)'
                : 'var(--app-text-secondary)',
              fontSize: 'var(--app-type-body)',
              fontWeight: isActive ? 700 : 500,
              letterSpacing: '0',
              transition: [
                'background var(--wa-motion-fast, 150ms)',
                'color var(--wa-motion-fast, 150ms)',
                'box-shadow var(--wa-motion-fast, 150ms)',
              ].join(', '),
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
