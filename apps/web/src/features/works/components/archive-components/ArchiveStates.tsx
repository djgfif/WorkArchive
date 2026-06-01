import {
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { ReactNode } from 'react';

import { AppBadge } from '@shared/components/AppPrimitives';
import { cn, css } from './styles';

interface ReviewNoteCardProps {
  emptyLabel?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

interface ArchiveEmptyStateProps {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
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
      <circle cx="80" cy="60" fill="currentColor" opacity="0.04" r="56" />
      <circle cx="80" cy="60" fill="currentColor" opacity="0.04" r="40" />
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
      <rect fill="currentColor" height="4" opacity="0.25" rx="2" width="30" x="65" y="56" />
      <rect fill="currentColor" height="3" opacity="0.15" rx="1.5" width="20" x="70" y="64" />
      <circle className={cn(css.emptySparkle1)} cx="28" cy="22" fill="currentColor" opacity="0.35" r="3" />
      <circle className={cn(css.emptySparkle2)} cx="132" cy="32" fill="currentColor" opacity="0.25" r="2" />
      <circle className={cn(css.emptySparkle1)} cx="140" cy="80" fill="currentColor" opacity="0.20" r="2.5" />
      <circle className={cn(css.emptySparkle2)} cx="20" cy="88" fill="currentColor" opacity="0.30" r="2" />
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
      <Text c="dimmed" maw="58ch">
        {description}
      </Text>
      {actions && (
        <Group gap="sm" wrap="wrap">
          {actions}
        </Group>
      )}
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
