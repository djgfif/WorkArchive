import {
  Collapse,
  Grid,
  Group,
  NativeSelect,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { useState, type FormEvent, type ReactNode } from 'react';

import {
  AppButton,
  FeedbackMessage,
  StateMessage,
} from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { CandidateListRow } from './CandidateListRow';
import { CandidatePreviewPanel } from './CandidatePreviewPanel';
import type { ProviderGroup } from './quick-add-helpers';
import {
  isManualProviderGroup,
  providerGroupOptions,
  quickAddTypeOptions,
} from './quick-add-helpers';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

export interface AddWorkSearchPanelProps {
  candidates: ImportCandidate[];
  duplicateCounts: Record<string, number>;
  duplicateMatches: WorkRecord[];
  fullHeight?: boolean;
  hasSearched: boolean;
  isSearching: boolean;
  onApplyCandidate: () => void;
  onProviderGroupChange: (value: ProviderGroup) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchTermChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
  onSelectCandidate: (candidate: ImportCandidate) => void;
  onUseManualTitle: () => void;
  providerGroup: ProviderGroup;
  providerReadinessSummary: ReactNode;
  searchError: string | null;
  searchNotice: string | null;
  searchTerm: string;
  searchType: string;
  selectedCandidate: ImportCandidate | null;
}

function SearchCandidateLoadingList() {
  return (
    <Stack
      aria-busy="true"
      aria-live="polite"
      data-testid="candidate-search-loading"
      gap="sm"
    >
      <Text fw={700}>검색 후보를 불러오는 중입니다</Text>
      <Text c="var(--mantine-color-dimmed)" size="sm">
        출처별 결과, 중복 가능성, 적용할 수 있는 정보를 함께 정리하고 있습니다.
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

function SearchPreviewLoading() {
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

export function AddWorkSearchPanel({
  candidates,
  duplicateCounts,
  duplicateMatches,
  fullHeight = false,
  hasSearched,
  isSearching,
  onApplyCandidate,
  onProviderGroupChange,
  onSearchSubmit,
  onSearchTermChange,
  onSearchTypeChange,
  onSelectCandidate,
  onUseManualTitle,
  providerGroup,
  providerReadinessSummary,
  searchError,
  searchNotice,
  searchTerm,
  searchType,
  selectedCandidate,
}: AddWorkSearchPanelProps) {
  const normalizedSearchTerm = searchTerm.trim();
  const isManualSearchGroup = isManualProviderGroup(providerGroup);
  const [providerOptionsOpen, setProviderOptionsOpen] = useState(false);
  const defaultProviderGroupOption = providerGroupOptions[0]!;
  const selectedProviderGroupOption =
    providerGroupOptions.find((option) => option.value === providerGroup) ??
    defaultProviderGroupOption;
  const shouldSuggestProviderChange =
    hasSearched &&
    !isSearching &&
    !isManualSearchGroup &&
    normalizedSearchTerm.length > 0 &&
    candidates.length <= 2;

  return (
    <Stack gap="lg">
      {providerReadinessSummary}

      <Paper
        className={cn(css.quickSearchSticky)}
        p="md"
        radius="lg"
        withBorder
      >
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
                {isSearching
                  ? '검색 중...'
                  : hasSearched
                    ? '다시 검색'
                    : '검색'}
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
                  </Text>
                </Stack>
                <AppButton
                  aria-expanded={providerOptionsOpen}
                  onClick={() => setProviderOptionsOpen((opened) => !opened)}
                  size="compact-sm"
                  tone={providerGroup === 'all' ? 'quiet' : 'secondary'}
                  type="button"
                >
                  검색 설정 열기
                </AppButton>
              </Group>

              <Collapse in={providerOptionsOpen}>
                <Stack gap={6} pt="sm">
                  <Text c="var(--mantine-color-dimmed)" fw={700} size="xs">
                    검색 출처 직접 선택
                  </Text>
                  <Group
                    gap="xs"
                    role="group"
                    aria-label="검색 출처"
                    wrap="wrap"
                  >
                    {providerGroupOptions.map((option) => (
                      <AppButton
                        aria-pressed={providerGroup === option.value}
                        key={option.value}
                        onClick={() => onProviderGroupChange(option.value)}
                        size="compact-sm"
                        tone={
                          providerGroup === option.value
                            ? 'primary'
                            : 'secondary'
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

      {searchError && (
        <FeedbackMessage tone="error">{searchError}</FeedbackMessage>
      )}
      {searchNotice && (
        <FeedbackMessage tone="info">{searchNotice}</FeedbackMessage>
      )}

      <Grid gutter="lg">
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
                          onClick={() => setProviderOptionsOpen(true)}
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
                    원하는 작품이 보이지 않으면 검색 출처를 바꿔 다시 찾거나,
                    아래 버튼으로 직접 추가를 이어갈 수 있습니다.
                  </FeedbackMessage>
                )}

                {!isManualSearchGroup && normalizedSearchTerm && (
                  <Stack className={cn(css.searchManualFallback)} gap={6}>
                    <Text fw={700} size="sm">
                      정확한 후보가 없나요?
                    </Text>
                    <Text c="var(--mantine-color-dimmed)" size="sm">
                      "{normalizedSearchTerm}"를 제목으로 저장 화면을
                      이어갑니다.
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
                          onClick={() => setProviderOptionsOpen(true)}
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

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper
            className={cn(css.searchPreviewPanel)}
            p="lg"
            radius="md"
            {...(fullHeight ? { mih: undefined } : {})}
            withBorder
          >
            {isSearching ? (
              <SearchPreviewLoading />
            ) : selectedCandidate ? (
              <CandidatePreviewPanel
                candidate={selectedCandidate}
                duplicateMatches={duplicateMatches}
                onApply={onApplyCandidate}
              />
            ) : (
              <StateMessage
                description={
                  isManualSearchGroup
                    ? '직접 추가 후보를 고르면 입력한 제목으로 기록을 시작할 수 있습니다.'
                    : hasSearched
                      ? '왼쪽 후보를 고르면 큰 포스터와 검색 근거를 여기서 바로 비교할 수 있습니다.'
                      : '검색 결과가 생기면 후보 정보와 내 기록 중복 가능성을 여기에서 확인합니다.'
                }
                title={
                  isManualSearchGroup
                    ? '직접 추가 후보를 먼저 선택하세요'
                    : hasSearched
                      ? '후보를 먼저 선택하세요'
                      : '검색 후보 미리보기'
                }
                tone="info"
              />
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
