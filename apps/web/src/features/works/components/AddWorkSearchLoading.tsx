import { Group, Skeleton, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

export function SearchCandidateLoadingList() {
  const { t } = useAppTranslation();

  return (
    <Stack
      aria-busy="true"
      aria-live="polite"
      data-testid="candidate-search-loading"
      gap="sm"
    >
      <Text fw={700}>{t('works.add.search.searchingCandidates')}</Text>
      <Text c="var(--mantine-color-dimmed)" size="sm">
        {t('works.add.search.searchingCandidatesDescription')}
      </Text>
      {Array.from({ length: 4 }, (_, index) => (
        <Stack
          className={
            index === 3
              ? `${cn(css.searchLoadingItem)} ${cn(css.searchLoadingItemLast)}`
              : cn(css.searchLoadingItem)
          }
          gap="xs"
          key={index}
        >
          <Group gap="xs" wrap="nowrap">
            <Skeleton height={20} radius="xl" width={68} />
            <Skeleton height={20} radius="xl" width={92} />
          </Group>
          <Skeleton height={16} radius="sm" width="70%" />
          <Skeleton height={12} radius="sm" width="48%" />
          <Skeleton height={12} radius="sm" width="82%" />
        </Stack>
      ))}
    </Stack>
  );
}

export function SearchPreviewLoading() {
  return (
    <Stack aria-busy="true" aria-live="polite" gap="md">
      <Stack gap="xs">
        <Skeleton height={18} radius="sm" width={120} />
        <Skeleton height={28} radius="sm" width="64%" />
        <Skeleton height={14} radius="sm" width="46%" />
      </Stack>
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Skeleton height={210} radius="md" width={142} />
        <Stack flex={1} gap="sm">
          <Skeleton height={14} radius="sm" width="88%" />
          <Skeleton height={14} radius="sm" width="72%" />
          <Skeleton height={14} radius="sm" width="54%" />
          <Group gap="xs">
            <Skeleton height={24} radius="xl" width={82} />
            <Skeleton height={24} radius="xl" width={112} />
          </Group>
        </Stack>
      </Group>
    </Stack>
  );
}
