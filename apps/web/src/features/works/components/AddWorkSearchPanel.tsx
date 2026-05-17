import {
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
import type { FormEvent, ReactNode } from 'react';

import {
  AppButton,
  FeedbackMessage,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import type { ImportCandidate } from '../../imports/services/imports.service';
import { CandidateListRow } from './CandidateListRow';
import { CandidatePreviewPanel } from './CandidatePreviewPanel';
import type { ProviderGroup } from './quick-add-helpers';
import {
  isManualProviderGroup,
  providerGroupOptions,
  quickAddTypeOptions,
} from './quick-add-helpers';

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
      <Text c="var(--app-text-muted)" size="sm">
        출처별 결과, 중복 가능성, 적용할 수 있는 정보를 함께 정리하고 있습니다.
      </Text>
      {Array.from({ length: 4 }, (_, index) => (
        <Stack
          gap="xs"
          key={index}
          style={{
            borderBottom:
              index === 3 ? 'none' : '1px solid var(--app-border-color)',
            paddingBlock: '0.5rem',
          }}
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

  return (
    <Stack gap="lg">
      {providerReadinessSummary}

      <form onSubmit={onSearchSubmit}>
        <Stack gap="sm">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <div style={{ flex: '1 1 20rem', minWidth: 'min(100%, 20rem)' }}>
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

            <div style={{ flex: '0 1 11rem', minWidth: 160 }}>
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

          <Stack gap={6}>
            <Text c="var(--app-text-muted)" fw={700} size="sm">
              검색 출처
            </Text>
            <Group gap="xs" wrap="wrap">
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
            <Text c="var(--app-text-muted)" size="xs">
              {
                providerGroupOptions.find(
                  (option) => option.value === providerGroup,
                )?.description
              }
            </Text>
          </Stack>
        </Stack>
      </form>

      {searchError && (
        <FeedbackMessage tone="error">{searchError}</FeedbackMessage>
      )}
      {searchNotice && (
        <FeedbackMessage tone="info">{searchNotice}</FeedbackMessage>
      )}

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper
            p="sm"
            radius="md"
            styles={{
              root: {
                background:
                  'linear-gradient(180deg, var(--app-surface-0), var(--app-surface-low))',
                borderColor: 'var(--app-border-color)',
              },
            }}
            withBorder
          >
            {isSearching ? (
              <SearchCandidateLoadingList />
            ) : candidates.length === 0 ? (
              <StateMessage
                actions={
                  normalizedSearchTerm ? (
                    <AppButton
                      onClick={onUseManualTitle}
                      tone="primary"
                      type="button"
                    >
                      직접 추가로 계속
                    </AppButton>
                  ) : undefined
                }
                description={
                  hasSearched
                    ? '입력한 제목으로 직접 기록할 수 있습니다.'
                    : '검색은 선택 사항입니다. 제목을 입력해 후보를 찾거나 직접 추가로 돌아가 바로 저장할 수 있습니다.'
                }
                title={
                  hasSearched
                    ? '검색 결과가 없습니다.'
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

                {!isManualSearchGroup && normalizedSearchTerm && (
                  <Stack
                    gap={6}
                    style={{
                      borderTop: '1px solid var(--app-border-color)',
                      paddingTop: '0.75rem',
                    }}
                  >
                    <Text fw={700} size="sm">
                      찾는 작품이 없나요?
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      "{normalizedSearchTerm}"를 직접 추가할 수 있습니다.
                    </Text>
                    <AppButton
                      onClick={onUseManualTitle}
                      tone="secondary"
                      type="button"
                    >
                      직접 추가로 계속
                    </AppButton>
                  </Stack>
                )}
              </Stack>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper
            p="lg"
            radius="md"
            styles={{
              root: {
                background:
                  'linear-gradient(180deg, var(--app-surface-1), var(--app-surface-low))',
                borderColor: 'var(--app-border-strong)',
                minHeight: fullHeight ? undefined : '34rem',
              },
            }}
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
