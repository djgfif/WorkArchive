import type { ReactNode } from 'react';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { WorkStatus } from '@work-archive/shared-types';

import { FilterPillGroup } from './ArchiveComponents';
import { RecordStateFilters } from './RecordStateFilters';
import { IconFilter } from './WorksToolbarIcons';
import styles from './ArchiveComponents.module.css';
import type { WorksListQuery } from '../utils/query-works';
import {
  buildGenreFilterOptions,
  buildStatusFilterOptions,
  identityPresetOptions,
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
              세부 필터
            </Text>
          </Group>
          {hasActiveFilters && (
            <Box
              className={cn(css.chipResetButton)}
              component="button"
              onClick={onClearFilters}
              type="button"
            >
              전체 초기화
            </Box>
          )}
        </Group>

        <Stack gap="md">
          <FilterSection title="분류">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  장르
                </Text>
                <FilterPillGroup
                  aria-label="장르 필터"
                  onChange={(genre) => onQueryChange({ ...query, genre })}
                  options={genreFilterOptions}
                  value={query.genre ?? ''}
                  variant="chips"
                />
              </Stack>

              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  개인 태그
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
                    placeholder="태그로 필터…"
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

          <FilterSection title="관계">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs">
                  시리즈 / 세계관
                </Text>
                <FilterPillGroup
                  aria-label="시리즈 필터"
                  onChange={(series) => onQueryChange({ ...query, series })}
                  options={[
                    { label: '전체', value: '' },
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
                  작가 / 제작진
                </Text>
                <FilterPillGroup
                  aria-label="작가 제작진 필터"
                  onChange={(personContributor) =>
                    onQueryChange({ ...query, personContributor })
                  }
                  options={[
                    { label: '전체', value: '' },
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
                  회사 / 플랫폼
                </Text>
                <FilterPillGroup
                  aria-label="회사 플랫폼 필터"
                  onChange={(organizationContributor) =>
                    onQueryChange({ ...query, organizationContributor })
                  }
                  options={[
                    { label: '전체', value: '' },
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

          <FilterSection title="기록 상태">
            <RecordStateFilters
              onQueryChange={onQueryChange}
              query={query}
              statusOptions={statusFilterOptions}
            />
          </FilterSection>

          <FilterSection title="등록 방식">
            <FilterPillGroup
              aria-label="등록 방식 필터"
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
