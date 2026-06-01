import { useState, type FormEvent } from 'react';
import type { CatalogSearchMediumType } from '@work-archive/shared-types';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] =
    useState<CatalogSearchMediumType>('all');
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
      setSearchError('먼저 작품 제목이나 작가를 검색해주세요.');
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
        error instanceof Error ? error.message : '후보 검색에 실패했습니다.';

      setSearchError(
        `${message} 검색 없이도 입력한 제목으로 직접 추가를 계속할 수 있습니다.`,
      );
      setSearchCandidates([]);
      setSelectedSearchCandidate(null);
      setSearchNotice(null);
    } finally {
      setIsSearching(false);
    }
  }

  function applyCandidateToForm() {
    if (!selectedSearchCandidate) {
      setSearchError('검색 결과에서 먼저 작품을 선택해주세요.');
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
