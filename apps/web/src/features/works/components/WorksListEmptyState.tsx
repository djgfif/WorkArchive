import {
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import type { WorksCollectionScope } from '../services/works.service';
import { ArchiveEmptyState } from './ArchiveComponents';

interface WorksListEmptyStateProps {
  collectionScope: WorksCollectionScope;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onOpenAddDialog: () => void;
  onReturnToActiveCollection: () => void;
}

export function WorksListEmptyState({
  collectionScope,
  hasActiveFilters,
  onClearFilters,
  onOpenAddDialog,
  onReturnToActiveCollection,
}: WorksListEmptyStateProps) {
  const isTrashScope = collectionScope === 'trash';

  return (
    <ArchiveEmptyState
      actions={
        <>
          {isTrashScope ? (
            <AppButton onClick={onReturnToActiveCollection} type="button">
              서재로 돌아가기
            </AppButton>
          ) : hasActiveFilters ? (
            <>
              <AppButton onClick={onClearFilters} type="button">
                필터 초기화
              </AppButton>
              <AppLinkButton to="/works/new" tone="secondary">
                직접 추가
              </AppLinkButton>
            </>
          ) : (
            <>
              <AppLinkButton to="/works/new" tone="primary">
                직접 추가
              </AppLinkButton>
              <AppButton
                onClick={onOpenAddDialog}
                tone="secondary"
                type="button"
              >
                검색으로 추가
              </AppButton>
              <AppLinkButton to="/account/settings" tone="quiet">
                JSON 백업 가져오기
              </AppLinkButton>
            </>
          )}
        </>
      }
      description={
        isTrashScope
          ? '삭제한 작품은 이곳에서 다시 확인하거나 복원할 수 있습니다.'
          : hasActiveFilters
            ? '검색어나 필터를 바꿔 다시 찾아보세요.'
            : '제목만 직접 남기거나, 검색으로 기본 정보를 불러오거나, 기존 JSON 백업에서 다시 시작할 수 있습니다.'
      }
      eyebrow={
        isTrashScope ? '휴지통' : hasActiveFilters ? '검색 결과 없음' : '빈 선반'
      }
      title={
        isTrashScope
          ? '휴지통이 비어 있습니다.'
          : hasActiveFilters
            ? '조건에 맞는 작품이 없습니다.'
            : '아직 기록한 작품이 없습니다.'
      }
    />
  );
}
