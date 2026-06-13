import { useState, type FormEvent } from 'react';
import type { CatalogSearchMediumType } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { importsService, type ImportCandidate } from '@features/imports';
import { useImportProviderReadiness } from '@features/imports';
import {
  getProviderGroupProviders,
  getVisibleSearchCandidates,
  type ProviderGroup,
} from '../components/quick-add-helpers';

interface UseAddWorkSearchOptions {
  enabled: boolean;
  onApplyCandidate: (candidate: ImportCandidate) => void;
  onUseManualTitle: (title: string) => void;
}

export function useAddWorkSearch({
  enabled,
  onApplyCandidate,
  onUseManualTitle,
}: UseAddWorkSearchOptions) {
  const { t } = useAppTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<CatalogSearchMediumType>('all');
  const [providerGroup, setProviderGroup] = useState<ProviderGroup>('all');
  const [searchCandidates, setSearchCandidates] = useState<ImportCandidate[]>(
    [],
  );
  const [selectedSearchCandidate, setSelectedSearchCandidate] =
    useState<ImportCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const providerReadiness = useImportProviderReadiness(enabled);

  function resetSearchSelection() {
    setSelectedSearchCandidate(null);
    setSearchNotice(null);
    setSearchError(null);
  }

  function clearSearchError() {
    setSearchError(null);
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      setSearchError(t('works.add.search.searchMissingInput'));
      return;
    }

    setSearchError(null);
    setSearchNotice(null);
    setSelectedSearchCandidate(null);
    setSearchCandidates([]);
    setHasSearched(true);

    try {
      setIsSearching(true);

      const providerGroupProviders = getProviderGroupProviders(providerGroup);
      const result = await importsService.searchCandidates(
        normalizedSearchTerm,
        {
          limit: 10,
          mediumType: searchType,
          ...(providerGroupProviders
            ? { providers: providerGroupProviders }
            : {}),
          useExternal: true,
        },
      );
      const visibleCandidates = getVisibleSearchCandidates(
        result.candidates,
        providerGroup,
      );

      setSearchCandidates(visibleCandidates);
      setSearchNotice(result.notice);
      setSelectedSearchCandidate(visibleCandidates[0] ?? null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('works.add.search.searchFailed');

      setSearchError(`${message} ${t('works.add.search.searchFallback')}`);
      setSearchCandidates([]);
      setSelectedSearchCandidate(null);
      setSearchNotice(null);
    } finally {
      setIsSearching(false);
    }
  }

  function applyCandidateToForm() {
    if (!selectedSearchCandidate) {
      setSearchError(t('works.add.search.selectCandidateFirst'));
      return;
    }

    onApplyCandidate(selectedSearchCandidate);
  }

  function useSearchTermForManualInput() {
    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      return;
    }

    resetSearchSelection();
    onUseManualTitle(normalizedSearchTerm);
  }

  function handleProviderGroupChange(value: ProviderGroup) {
    setProviderGroup(value);
    setSearchCandidates([]);
    setSelectedSearchCandidate(null);
    setSearchNotice(null);
    setSearchError(null);
    setHasSearched(false);
  }

  function handleSearchTypeChange(value: string) {
    setSearchType(value as CatalogSearchMediumType);
  }

  return {
    applyCandidateToForm,
    clearSearchError,
    handleProviderGroupChange,
    handleSearchSubmit,
    handleSearchTypeChange,
    hasSearched,
    isSearching,
    providerGroup,
    providerReadiness,
    resetSearchSelection,
    searchCandidates,
    searchError,
    searchNotice,
    searchTerm,
    searchType,
    selectedSearchCandidate,
    setSearchTerm,
    setSelectedSearchCandidate,
    useSearchTermForManualInput,
  };
}
