import {
  Collapse,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { FormEvent } from 'react';

import { AppButton } from '@shared/components/AppPrimitives';
import type { ProviderGroup } from './quick-add-helpers';
import { providerGroupOptions, quickAddTypeOptions } from './quick-add-helpers';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface AddWorkSearchFormProps {
  hasSearched: boolean;
  isSearching: boolean;
  onProviderGroupChange: (value: ProviderGroup) => void;
  onProviderOptionsToggle: () => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchTermChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
  providerGroup: ProviderGroup;
  providerOptionsOpen: boolean;
  searchTerm: string;
  searchType: string;
  shouldSuggestProviderChange: boolean;
}

export function AddWorkSearchForm({
  hasSearched,
  isSearching,
  onProviderGroupChange,
  onProviderOptionsToggle,
  onSearchSubmit,
  onSearchTermChange,
  onSearchTypeChange,
  providerGroup,
  providerOptionsOpen,
  searchTerm,
  searchType,
  shouldSuggestProviderChange,
}: AddWorkSearchFormProps) {
  const defaultProviderGroupOption = providerGroupOptions[0]!;
  const selectedProviderGroupOption =
    providerGroupOptions.find((option) => option.value === providerGroup) ??
    defaultProviderGroupOption;

  return (
    <Paper className={cn(css.quickSearchSticky)} p="md" radius="lg" withBorder>
      <form onSubmit={onSearchSubmit}>
        <Stack gap="sm">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <div className={cn(css.quickSearchField)}>
              <TextInput
                id="quickAddSearch"
                label="작품 검색"
                onChange={(event) =>
                  onSearchTermChange(event.currentTarget.value)
                }
                placeholder="제목, 작가, 스튜디오를 입력하세요"
                value={searchTerm}
              />
            </div>

            <div className={cn(css.quickSearchType)}>
              <NativeSelect
                id="quickAddType"
                label="작품 유형"
                onChange={(event) =>
                  onSearchTypeChange(event.currentTarget.value)
                }
                value={searchType}
              >
                {quickAddTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <AppButton loading={isSearching} tone="primary" type="submit">
              {isSearching ? '검색 중...' : hasSearched ? '다시 검색' : '검색'}
            </AppButton>
          </Group>

          <Paper
            className={cn(css.quickSearchOptionsPanel)}
            p="xs"
            radius="md"
            withBorder
          >
            <Group align="center" justify="space-between" wrap="wrap">
              <Stack gap={1}>
                <Text fw={750} size="sm">
                  검색은 직접 입력을 돕는 보조 도구입니다
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="xs">
                  현재 {selectedProviderGroupOption.label}
                  {providerGroup !== 'all'
                    ? ` · ${selectedProviderGroupOption.description}`
                    : ''}
                  {shouldSuggestProviderChange
                    ? ' · 결과가 부족하면 검색 출처를 바꿔볼 수 있습니다.'
                    : ''}
                  {' · 후보를 적용해도 바로 저장되지 않고 입력칸만 채웁니다.'}
                </Text>
              </Stack>
              <AppButton
                aria-expanded={providerOptionsOpen}
                onClick={onProviderOptionsToggle}
                size="compact-sm"
                tone={providerGroup === 'all' ? 'quiet' : 'secondary'}
                type="button"
              >
                검색 설정 열기
              </AppButton>
            </Group>

            <Collapse expanded={providerOptionsOpen}>
              <Stack gap={6} pt="sm">
                <Text c="var(--mantine-color-dimmed)" fw={700} size="xs">
                  검색 출처 직접 선택
                </Text>
                <Group gap="xs" role="group" aria-label="검색 출처" wrap="wrap">
                  {providerGroupOptions.map((option) => (
                    <AppButton
                      aria-pressed={providerGroup === option.value}
                      key={option.value}
                      onClick={() => onProviderGroupChange(option.value)}
                      size="compact-sm"
                      tone={
                        providerGroup === option.value ? 'primary' : 'secondary'
                      }
                      type="button"
                    >
                      {option.label}
                    </AppButton>
                  ))}
                </Group>
                <Text c="var(--mantine-color-dimmed)" size="xs">
                  결과가 없거나 후보가 부족할 때 출처를 좁혀 다시 검색할 수
                  있습니다. 검색 없이도 직접 추가로 계속할 수 있습니다.
                </Text>
              </Stack>
            </Collapse>
          </Paper>
        </Stack>
      </form>
    </Paper>
  );
}
