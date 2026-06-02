import { Grid, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';

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
  return (
    <Grid.Col span={{ base: 12, md: 5 }}>
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
                    직접 추가로 계속
                  </AppButton>
                  {!isManualSearchGroup && (
                    <AppButton
                      aria-expanded={providerOptionsOpen}
                      onClick={onOpenProviderOptions}
                      tone="secondary"
                      type="button"
                    >
                      검색 설정 열기
                    </AppButton>
                  )}
                </Group>
              ) : undefined
            }
            description={
              hasSearched
                ? '정확한 후보가 없으면 입력한 제목으로 직접 추가를 이어가세요. 필요하면 검색 설정을 열어 출처를 바꿀 수 있습니다.'
                : '검색은 선택 사항입니다. 제목을 입력해 후보를 찾거나 직접 추가로 돌아가 바로 저장할 수 있습니다.'
            }
            title={
              hasSearched
                ? '검색 결과가 없습니다'
                : '검색어를 입력해 후보를 찾아보세요.'
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
                원하는 작품이 보이지 않으면 검색 출처를 바꿔 다시 찾거나, 아래
                버튼으로 직접 추가를 이어갈 수 있습니다.
              </FeedbackMessage>
            )}

            {!isManualSearchGroup && normalizedSearchTerm && (
              <Stack className={cn(css.searchManualFallback)} gap={6}>
                <Text fw={700} size="sm">
                  정확한 후보가 없나요?
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  "{normalizedSearchTerm}"를 제목으로 저장 화면을 이어갑니다.
                </Text>
                <Group gap="xs">
                  <AppButton
                    onClick={onUseManualTitle}
                    tone="secondary"
                    type="button"
                  >
                    직접 추가로 계속
                  </AppButton>
                  {shouldSuggestProviderChange && (
                    <AppButton
                      aria-expanded={providerOptionsOpen}
                      onClick={onOpenProviderOptions}
                      tone="quiet"
                      type="button"
                    >
                      검색 설정 열기
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
