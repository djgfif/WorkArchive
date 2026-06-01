import { Grid, Paper } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { StateMessage } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { CandidatePreviewPanel } from './CandidatePreviewPanel';
import { SearchPreviewLoading } from './AddWorkSearchLoading';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface AddWorkSearchPreviewProps {
  duplicateMatches: WorkRecord[];
  fullHeight: boolean;
  hasSearched: boolean;
  isManualSearchGroup: boolean;
  isSearching: boolean;
  onApplyCandidate: () => void;
  selectedCandidate: ImportCandidate | null;
}

export function AddWorkSearchPreview({
  duplicateMatches,
  fullHeight,
  hasSearched,
  isManualSearchGroup,
  isSearching,
  onApplyCandidate,
  selectedCandidate,
}: AddWorkSearchPreviewProps) {
  return (
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
  );
}
