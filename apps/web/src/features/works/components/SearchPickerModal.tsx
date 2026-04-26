import {
  Grid,
  Group,
  Modal,
  NativeSelect,
  Paper,
  ScrollArea,
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
import type {
  ProviderGroup,
} from './quick-add-helpers';
import {
  providerGroupOptions,
  quickAddTypeOptions,
} from './quick-add-helpers';

interface SearchPickerModalProps {
  candidates: ImportCandidate[];
  duplicateCounts: Record<string, number>;
  duplicateMatches: WorkRecord[];
  fullScreen: boolean;
  isSearching: boolean;
  onApplyCandidate: () => void;
  onClose: () => void;
  onProviderGroupChange: (value: ProviderGroup) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchTermChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
  onSelectCandidate: (candidate: ImportCandidate) => void;
  onUseManualTitle: () => void;
  opened: boolean;
  providerGroup: ProviderGroup;
  providerReadinessSummary: ReactNode;
  searchError: string | null;
  searchNotice: string | null;
  searchTerm: string;
  searchType: string;
  selectedCandidate: ImportCandidate | null;
}

export function SearchPickerModal({
  candidates,
  duplicateCounts,
  duplicateMatches,
  fullScreen,
  isSearching,
  onApplyCandidate,
  onClose,
  onProviderGroupChange,
  onSearchSubmit,
  onSearchTermChange,
  onSearchTypeChange,
  onSelectCandidate,
  onUseManualTitle,
  opened,
  providerGroup,
  providerReadinessSummary,
  searchError,
  searchNotice,
  searchTerm,
  searchType,
  selectedCandidate,
}: SearchPickerModalProps) {
  return (
    <Modal
      centered={!fullScreen}
      fullScreen={fullScreen}
      onClose={onClose}
      opened={opened}
      padding="lg"
      radius="lg"
      size="min(72rem, 100vw - 2rem)"
      title="검색으로 정보 채우기"
    >
      <Stack gap="lg">
        {providerReadinessSummary}

        <form onSubmit={onSearchSubmit}>
          <Stack gap="sm">
            <Group align="flex-end" gap="sm" wrap="wrap">
              <div style={{ flex: '1 1 20rem', minWidth: 'min(100%, 20rem)' }}>
                <TextInput
                  id="quickAddSearch"
                  label="작품 검색"
                  onChange={(event) => onSearchTermChange(event.currentTarget.value)}
                  placeholder="제목, 작가, 스튜디오를 입력하세요"
                  value={searchTerm}
                />
              </div>

              <div style={{ flex: '0 1 11rem', minWidth: 160 }}>
                <NativeSelect
                  id="quickAddType"
                  label="작품 유형"
                  onChange={(event) => onSearchTypeChange(event.currentTarget.value)}
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
                {isSearching ? '검색 중...' : '다시 검색'}
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
                    tone={providerGroup === option.value ? 'primary' : 'secondary'}
                    type="button"
                  >
                    {option.label}
                  </AppButton>
                ))}
              </Group>
              <Text c="var(--app-text-muted)" size="xs">
                {
                  providerGroupOptions.find((option) => option.value === providerGroup)
                    ?.description
                }
              </Text>
            </Stack>
          </Stack>
        </form>

        {searchError && <FeedbackMessage tone="error">{searchError}</FeedbackMessage>}
        {searchNotice && <FeedbackMessage tone="info">{searchNotice}</FeedbackMessage>}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper
              p="sm"
              radius="lg"
              styles={{
                root: {
                  backgroundColor: 'var(--app-surface-0)',
                  borderColor: 'var(--app-border-color)',
                },
              }}
              withBorder
            >
              {isSearching ? (
                <StateMessage
                  description="검색 출처별 후보를 정리하고 있습니다."
                  title="검색 중입니다."
                  tone="loading"
                />
              ) : candidates.length === 0 ? (
                <StateMessage
                  actions={
                    searchTerm.trim() ? (
                      <AppButton onClick={onUseManualTitle} tone="primary" type="button">
                        "{searchTerm.trim()}" 직접 추가
                      </AppButton>
                    ) : undefined
                  }
                  description="다른 제목으로 다시 검색하거나, 지금 입력한 제목으로 직접 추가할 수 있습니다."
                  title="검색 결과가 없습니다"
                  tone="info"
                />
              ) : (
                <ScrollArea.Autosize mah={fullScreen ? undefined : 540} type="scroll">
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
              )}
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper
              p="lg"
              radius="lg"
              styles={{
                root: {
                  backgroundColor: 'var(--app-surface-1)',
                  borderColor: 'var(--app-border-strong)',
                  minHeight: fullScreen ? undefined : '34rem',
                },
              }}
              withBorder
            >
              {selectedCandidate ? (
                <CandidatePreviewPanel
                  candidate={selectedCandidate}
                  duplicateMatches={duplicateMatches}
                  onApply={onApplyCandidate}
                />
              ) : (
                <StateMessage
                  description="왼쪽 후보를 고르면 큰 포스터와 검색 근거를 여기서 바로 비교할 수 있습니다."
                  title="후보를 먼저 선택하세요"
                  tone="info"
                />
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Modal>
  );
}
