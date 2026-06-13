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

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
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
                label={t('works.add.search.searchLabel')}
                onChange={(event) =>
                  onSearchTermChange(event.currentTarget.value)
                }
                placeholder={t('works.add.search.searchPlaceholder')}
                value={searchTerm}
              />
            </div>

            <div className={cn(css.quickSearchType)}>
              <NativeSelect
                id="quickAddType"
                label={t('works.add.search.typeLabel')}
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
              {isSearching
                ? t('works.add.search.searching')
                : hasSearched
                  ? t('works.add.search.searchAgain')
                  : t('works.add.search.searchSubmit')}
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
                  {t('works.add.search.helperTitle')}
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="xs">
                  {t('works.add.search.helperProviderDescription', {
                    description:
                      providerGroup !== 'all'
                        ? ` · ${selectedProviderGroupOption.description}`
                        : '',
                    label: selectedProviderGroupOption.label,
                  })}
                  {shouldSuggestProviderChange
                    ? ` · ${t('works.add.search.helperProviderChange')}`
                    : ''}
                  {` · ${t('works.add.search.helperApplyNote')}`}
                </Text>
              </Stack>
              <AppButton
                aria-expanded={providerOptionsOpen}
                onClick={onProviderOptionsToggle}
                size="compact-sm"
                tone={providerGroup === 'all' ? 'quiet' : 'secondary'}
                type="button"
              >
                {t('works.add.search.providerSettingsOpen')}
              </AppButton>
            </Group>

            <Collapse expanded={providerOptionsOpen}>
              <Stack gap={6} pt="sm">
                <Text c="var(--mantine-color-dimmed)" fw={700} size="xs">
                  {t('works.add.search.providerSelectionLabel')}
                </Text>
                <Group
                  gap="xs"
                  role="group"
                  aria-label={t('works.add.search.providerSelectionAria')}
                  wrap="wrap"
                >
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
                  {t('works.add.search.providerSelectionDescription')}
                </Text>
              </Stack>
            </Collapse>
          </Paper>
        </Stack>
      </form>
    </Paper>
  );
}
