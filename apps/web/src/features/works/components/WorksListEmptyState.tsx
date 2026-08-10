import { AppButton, AppLinkButton } from '@shared/components/AppPrimitives';
import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';
import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
  const isTrashScope = collectionScope === 'trash';
  const sitesGuestPoc = isSitesGuestPoc();

  return (
    <ArchiveEmptyState
      actions={
        <>
          {isTrashScope ? (
            <AppButton onClick={onReturnToActiveCollection} type="button">
              {t('works.list.returnToLibrary')}
            </AppButton>
          ) : hasActiveFilters ? (
            <>
              <AppButton onClick={onClearFilters} type="button">
                {t('works.list.resetFilters')}
              </AppButton>
              <AppLinkButton to="/works/new" tone="secondary">
                {t('works.list.directAdd')}
              </AppLinkButton>
            </>
          ) : (
            <>
              <AppLinkButton to="/works/new" tone="primary">
                {t('works.list.directAdd')}
              </AppLinkButton>
              {!sitesGuestPoc && (
                <AppButton
                  onClick={onOpenAddDialog}
                  tone="secondary"
                  type="button"
                >
                  {t('works.list.searchAdd')}
                </AppButton>
              )}
              <AppLinkButton to="/account/settings" tone="quiet">
                {t('works.list.importJsonBackup')}
              </AppLinkButton>
            </>
          )}
        </>
      }
      description={
        isTrashScope
          ? t('works.list.emptyTrashDescription')
          : hasActiveFilters
            ? t('works.list.emptyFilterDescription')
            : t(
                sitesGuestPoc ? 'works.list.emptyActiveSitesPocDescription' : 'works.list.emptyActiveDescription',
              )
      }
      eyebrow={
        isTrashScope
          ? t('works.list.emptyTrashEyebrow')
          : hasActiveFilters
            ? t('works.list.emptyFilterEyebrow')
            : t('works.list.emptyActiveEyebrow')
      }
      title={
        isTrashScope
          ? t('works.list.emptyTrashTitle')
          : hasActiveFilters
            ? t('works.list.emptyFilterTitle')
            : t('works.list.emptyActiveTitle')
      }
    />
  );
}
