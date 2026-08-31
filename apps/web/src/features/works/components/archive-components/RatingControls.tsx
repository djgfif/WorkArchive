import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useAppTranslation, type AppTranslationKey } from '@app/i18n';
import { cn, css } from './styles';

function getStarLabelKey(value: number) {
  return `works.rating.star${value.toFixed(1).replace('.', '_')}` as AppTranslationKey;
}

interface RatingDisplayProps {
  compact?: boolean;
  value: number | null;
}

export interface StarRatingInputProps {
  label?: string;
  onChange: (value: number | null) => void;
  value: number | null;
}

export function RatingDisplay({ compact = false, value }: RatingDisplayProps) {
  const { t } = useAppTranslation();

  if (value === null) {
    return (
      <Text c="dimmed" size={compact ? 'xs' : 'sm'}>
        {t('works.rating.missing')}
      </Text>
    );
  }

  const filled = Math.floor(value);
  const half = value % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - filled - half;
  const label = t(getStarLabelKey(value));

  return (
    <Group align="center" gap={compact ? 3 : 5} wrap="nowrap">
      {Array.from({ length: filled }).map((_, index) => (
        <Text
          component="span"
          key={`f${index}`}
          style={{
            color: 'var(--app-accent-warm, #f59e0b)',
            fontSize: compact ? '0.85rem' : '1rem',
            lineHeight: 1,
          }}
        >
          ★
        </Text>
      ))}
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
      {Array.from({ length: empty }).map((_, index) => (
        <Text
          component="span"
          key={`e${index}`}
          style={{
            color: 'var(--app-border-default)',
            fontSize: compact ? '0.85rem' : '1rem',
            lineHeight: 1,
          }}
        >
          ☆
        </Text>
      ))}
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
          style={{
            color: 'var(--app-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value.toFixed(1)}
        </Text>
      )}
    </Group>
  );
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

export function StarRatingInput({
  label,
  onChange,
  value,
}: StarRatingInputProps) {
  const { t } = useAppTranslation();
  const resolvedLabel = label ?? t('works.rating.defaultLabel');
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;
  const displayLabel =
    displayValue > 0
      ? `${displayValue.toFixed(1)} · ${t(getStarLabelKey(displayValue), {
          defaultValue: t('works.rating.fallback'),
        })}`
      : t('works.rating.missing');
  const semanticLabel =
    value === null
      ? t('works.rating.semanticEmpty')
      : t('works.rating.semanticValue', { value: value.toFixed(1) });

  function getPointerRating(event: PointerEvent<HTMLButtonElement>) {
    const starElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-rating-star-index]'),
    );
    const fallbackRect = event.currentTarget.getBoundingClientRect();

    if (starElements.length > 0) {
      const firstRect = starElements[0]?.getBoundingClientRect();
      const lastRect =
        starElements[starElements.length - 1]?.getBoundingClientRect();

      if (firstRect && lastRect && lastRect.right > firstRect.left) {
        const clampedX = Math.min(
          lastRect.right,
          Math.max(firstRect.left, event.clientX),
        );
        const rawRating =
          ((clampedX - firstRect.left) / (lastRect.right - firstRect.left)) * 5;
        return Math.max(0.5, Math.min(5, Math.ceil(rawRating * 2) / 2));
      }
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
    setHoverValue(null);

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
    <Box className={cn(css.starRatingInput)} data-has-value={value !== null}>
      <Group align="center" justify="space-between" wrap="nowrap">
        <Text c="var(--app-text-secondary)" fw={750} size="sm">
          {resolvedLabel}
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Text className={cn(css.starRatingScore)}>{displayLabel}</Text>
          {value !== null && (
            <ActionIcon
              aria-label={t('works.rating.clearAria')}
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
        aria-label={resolvedLabel}
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
          const fillPercent = Math.min(
            100,
            Math.max(0, (displayValue - index) * 100),
          );

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
