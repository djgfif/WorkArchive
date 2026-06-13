import type { ReactNode } from 'react';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { WorkStatus } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { FilterPillGroup } from './ArchiveComponents';
import { RecordStateFilters } from './RecordStateFilters';
import { IconFilter } from './WorksToolbarIcons';
import styles from './ArchiveComponents.module.css';
import type { WorksListQuery } from '../utils/query-works';
import {
  buildGenreFilterOptions,
  buildStatusFilterOptions,
  identityPresetOptions,
  serialStatusFilterOptions,
} from '../utils/works-toolbar-state';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface FilterSectionProps {
  children: ReactNode;
  description?: string;
  frame?: 'default' | 'quiet';
  title: string;
}

function FilterSection({
  children,
  description,
  frame = 'default',
  title,
}: FilterSectionProps) {
  const isQuiet = frame === 'quiet';

  return (
    <Box
      className={cn(css.filterSection)}
      data-frame={isQuiet ? 'quiet' : 'default'}
    >
      <Stack gap="sm">
        <Group align="baseline" gap="xs" wrap="wrap">
          <Text
            className={cn(css.filterSectionTitle)}
            c="var(--app-text-primary)"
            fw={800}
            size="sm"
          >
            {title}
          </Text>
          {description ? (
            <Text c="var(--app-text-muted)" size="xs">
              {description}
            </Text>
          ) : null}
        </Group>
        {children}
      </Stack>
    </Box>
  );
}

interface AdvancedFiltersPanelProps {
  advancedOpen: boolean;
  genreSuggestions: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onQueryChange: (query: WorksListQuery) => void;
  organizationContributorSuggestions: string[];
  personContributorSuggestions: string[];
  query: WorksListQuery;
  seriesSuggestions: string[];
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  totalActiveCount: number;
}

export function AdvancedFiltersPanel({
  advancedOpen,
  genreSuggestions,
  hasActiveFilters,
  onClearFilters,
  onQueryChange,
  organizationContributorSuggestions,
  personContributorSuggestions,
  query,
  seriesSuggestions,
  statusCounts,
  tagSuggestions,
  totalActiveCount,
}: AdvancedFiltersPanelProps) {
  const { t } = useAppTranslation();
  const genreFilterOptions = buildGenreFilterOptions(genreSuggestions);
  const statusFilterOptions = buildStatusFilterOptions({
    statusCounts,
    totalActiveCount,
  });

  return (
    <Box
      className={cn(css.advancedFilterCollapse)}
      data-open={advancedOpen ? 'true' : 'false'}
    >
      <Box className={cn(css.advancedFilterPanel)}>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Box className={cn(css.advancedFilterHeaderIcon)}>
              <IconFilter size={13} />
            </Box>
            <Text className={cn(css.advancedFilterTitle)} fw={700} size="sm">
              {t('works.list.advancedFilterTitle')}
            </Text>
          </Group>
          {hasActiveFilters && (
            <Box
              className={cn(css.chipResetButton)}
              component="button"
              onClick={onClearFilters}
              type="button"
            >
              {t('works.list.resetAll')}
            </Box>
          )}
        </Group>

        <Stack gap="md">
          <FilterSection title={t('works.list.filterCategory')}>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.detail.genre')}
                </Text>
                <FilterPillGroup
                  aria-label={t('works.list.filterGenreAria')}
                  onChange={(genre) => onQueryChange({ ...query, genre })}
                  options={genreFilterOptions}
                  value={query.genre ?? ''}
                  variant="chips"
                />
              </Stack>

              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.list.filterPersonalTag')}
                </Text>
                <Box className={cn(css.tagFilterField)}>
                  <Box
                    className={cn(css.tagFilterInput)}
                    component="input"
                    list="worksTagFilterSuggestions"
                    name="tag"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      onQueryChange({
                        ...query,
                        tag: event.currentTarget.value,
                      })
                    }
                    placeholder={t('works.list.filterTagPlaceholder')}
                    value={query.tag ?? ''}
                  />
                  <datalist id="worksTagFilterSuggestions">
                    {tagSuggestions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </Box>
                {tagSuggestions.length > 0 && (
                  <Group gap={4} wrap="wrap">
                    {tagSuggestions.slice(0, 8).map((tag) => (
                      <Box
                        className={cn(css.tagSuggestionChip)}
                        component="button"
                        data-active={query.tag === tag ? 'true' : 'false'}
                        key={tag}
                        onClick={() => onQueryChange({ ...query, tag })}
                        type="button"
                      >
                        #{tag}
                      </Box>
                    ))}
                  </Group>
                )}
              </Stack>
            </SimpleGrid>
          </FilterSection>

          <FilterSection title={t('works.list.filterRelation')}>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.list.filterSeriesLabel')}
                </Text>
                <FilterPillGroup
                  aria-label={t('works.list.filterSeriesAria')}
                  onChange={(series) => onQueryChange({ ...query, series })}
                  options={[
                    { label: t('works.list.filterAll'), value: '' },
                    ...seriesSuggestions.slice(0, 12).map((series) => ({
                      label: series,
                      value: series,
                    })),
                  ]}
                  value={query.series ?? ''}
                  variant="chips"
                />
              </Stack>

              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.list.filterPersonContributorLabel')}
                </Text>
                <FilterPillGroup
                  aria-label={t('works.list.filterPersonContributorAria')}
                  onChange={(personContributor) =>
                    onQueryChange({ ...query, personContributor })
                  }
                  options={[
                    { label: t('works.list.filterAll'), value: '' },
                    ...personContributorSuggestions
                      .slice(0, 12)
                      .map((contributor) => ({
                        label: contributor,
                        value: contributor,
                      })),
                  ]}
                  value={query.personContributor ?? ''}
                  variant="chips"
                />
              </Stack>

              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.list.filterOrganizationContributorLabel')}
                </Text>
                <FilterPillGroup
                  aria-label={t('works.list.filterOrganizationContributorAria')}
                  onChange={(organizationContributor) =>
                    onQueryChange({ ...query, organizationContributor })
                  }
                  options={[
                    { label: t('works.list.filterAll'), value: '' },
                    ...organizationContributorSuggestions
                      .slice(0, 12)
                      .map((contributor) => ({
                        label: contributor,
                        value: contributor,
                      })),
                  ]}
                  value={query.organizationContributor ?? ''}
                  variant="chips"
                />
              </Stack>
            </SimpleGrid>
          </FilterSection>

          <FilterSection title={t('works.list.filterRecordStatus')}>
            <Stack gap="md">
              <RecordStateFilters
                onQueryChange={onQueryChange}
                query={query}
                statusOptions={statusFilterOptions}
              />
              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  {t('works.list.filterSerialStatus')}
                </Text>
                <FilterPillGroup
                  aria-label={t('works.list.filterSerialStatusAria')}
                  onChange={(serialStatus) =>
                    onQueryChange({ ...query, serialStatus })
                  }
                  options={serialStatusFilterOptions}
                  value={query.serialStatus ?? 'all'}
                />
              </Stack>
            </Stack>
          </FilterSection>

          <FilterSection title={t('works.list.filterIdentitySection')}>
            <FilterPillGroup
              aria-label={t('works.list.filterIdentityAria')}
              onChange={(identityPreset) =>
                onQueryChange({ ...query, identityPreset })
              }
              options={identityPresetOptions}
              value={query.identityPreset ?? 'all'}
            />
          </FilterSection>
        </Stack>
      </Box>
    </Box>
  );
}
