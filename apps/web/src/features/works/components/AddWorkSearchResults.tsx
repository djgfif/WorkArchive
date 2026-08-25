import { Grid, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  AppButton,
  FeedbackMessage,
  StateMessage,
} from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { CandidateListRow } from './CandidateListRow';
import { SearchCandidateLoadingList } from './AddWorkSearchLoading';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface AddWorkSearchResultsProps {
  candidates: ImportCandidate[];
  duplicateCounts: Record<string, number>;
  fullHeight: boolean;
  hasSearched: boolean;
  isManualSearchGroup: boolean;
  isSearching: boolean;
  normalizedSearchTerm: string;
  onOpenProviderOptions: () => void;
  onSelectCandidate: (candidate: ImportCandidate) => void;
  onUseManualTitle: () => void;
  providerOptionsOpen: boolean;
  selectedCandidate: ImportCandidate | null;
  shouldSuggestProviderChange: boolean;
}

export function AddWorkSearchResults({
  candidates,
  duplicateCounts,
  fullHeight,
  hasSearched,
  isManualSearchGroup,
  isSearching,
  normalizedSearchTerm,
  onOpenProviderOptions,
  onSelectCandidate,
  onUseManualTitle,
  providerOptionsOpen,
  selectedCandidate,
  shouldSuggestProviderChange,
}: AddWorkSearchResultsProps) {
  const { t } = useAppTranslation();

  return (
    <Grid.Col span={{ base: 12, md: 7 }}>
      <Paper
        className={cn(css.searchResultPanel)}
        p="sm"
        radius="md"
        withBorder
      >
        {isSearching ? (
          <SearchCandidateLoadingList />
        ) : candidates.length === 0 ? (
          <StateMessage
            actions={
              normalizedSearchTerm ? (
                <Group gap="xs" justify="center">
                  <AppButton
                    onClick={onUseManualTitle}
                    tone="primary"
                    type="button"
                  >
                    {t('works.add.search.resultManualContinue')}
                  </AppButton>
                  {!isManualSearchGroup && (
                    <AppButton
                      aria-expanded={providerOptionsOpen}
                      onClick={onOpenProviderOptions}
                      tone="secondary"
                      type="button"
                    >
                      {t('works.add.search.providerSettingsOpen')}
                    </AppButton>
                  )}
                </Group>
              ) : undefined
            }
            description={
              hasSearched
                ? t('works.add.search.emptyAfterSearchDescription')
                : t('works.add.search.emptyInitialDescription')
            }
            title={
              hasSearched
                ? t('works.add.search.emptyAfterSearchTitle')
                : t('works.add.search.emptyInitialTitle')
            }
            tone="info"
          />
        ) : (
          <Stack gap="sm">
            <ScrollArea.Autosize
              mah={fullHeight ? undefined : 540}
              type="scroll"
            >
              <Stack gap="sm">
                {candidates.map((candidate) => (
                  <CandidateListRow
                    active={selectedCandidate?.id === candidate.id}
                    candidate={candidate}
                    duplicateCount={duplicateCounts[candidate.id] ?? 0}
                    key={candidate.id}
                    onSelect={() => onSelectCandidate(candidate)}
                  />
                ))}
              </Stack>
            </ScrollArea.Autosize>

            {shouldSuggestProviderChange && (
              <FeedbackMessage tone="info">
                {t('works.add.search.providerChangeHint')}
              </FeedbackMessage>
            )}

            {!isManualSearchGroup && normalizedSearchTerm && (
              <Stack className={cn(css.searchManualFallback)} gap={6}>
                <Text fw={700} size="sm">
                  {t('works.add.search.noExactCandidateTitle')}
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {t('works.add.search.manualTitleDescription', {
                    title: normalizedSearchTerm,
                  })}
                </Text>
                <Group gap="xs">
                  <AppButton
                    onClick={onUseManualTitle}
                    tone="secondary"
                    type="button"
                  >
                    {t('works.add.search.resultManualContinue')}
                  </AppButton>
                  {shouldSuggestProviderChange && (
                    <AppButton
                      aria-expanded={providerOptionsOpen}
                      onClick={onOpenProviderOptions}
                      tone="quiet"
                      type="button"
                    >
                      {t('works.add.search.providerSettingsOpen')}
                    </AppButton>
                  )}
                </Group>
              </Stack>
            )}
          </Stack>
        )}
      </Paper>
    </Grid.Col>
  );
}
