import { useEffect, useMemo, useState } from 'react';

import {
  importsService,
  type ImportProviderStatus,
} from '../../imports/services/imports.service';

type SettingsAuthMode = 'authenticated' | 'guest';

export interface SettingsFeedback {
  message: string;
  tone: 'error' | 'info' | 'success';
}

export function useImportProviderSettings(mode: SettingsAuthMode) {
  const [providerStatuses, setProviderStatuses] = useState<
    ImportProviderStatus[]
  >([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [credentialDraft, setCredentialDraft] = useState<
    Record<string, string>
  >({});
  const [isLoadingProviderStatuses, setIsLoadingProviderStatuses] =
    useState(false);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(
    null,
  );
  const [providerFeedback, setProviderFeedback] =
    useState<SettingsFeedback | null>(null);

  const keyManagedProviders = useMemo(
    () =>
      providerStatuses.filter((status) => status.credentialMode === 'user'),
    [providerStatuses],
  );

  const selectedProvider =
    keyManagedProviders.find((status) => status.provider === selectedProviderId) ??
    keyManagedProviders[0] ??
    null;

  useEffect(() => {
    let isCancelled = false;

    async function loadProviderStatuses() {
      if (mode !== 'authenticated') {
        setProviderStatuses([]);
        setSelectedProviderId(null);
        setCredentialDraft({});
        setProviderFeedback(null);

        return;
      }

      try {
        setIsLoadingProviderStatuses(true);
        const statuses = await importsService.listProviders();

        if (!isCancelled) {
          const firstKeyProvider =
            statuses.find((status) => status.credentialMode === 'user') ??
            null;

          setProviderStatuses(statuses);
          setSelectedProviderId((current) =>
            current && statuses.some((status) => status.provider === current)
              ? current
              : firstKeyProvider?.provider ?? null,
          );
          setProviderFeedback(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setProviderFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : '검색 provider 상태를 불러오지 못했습니다.',
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProviderStatuses(false);
        }
      }
    }

    void loadProviderStatuses();

    return () => {
      isCancelled = true;
    };
  }, [mode]);

  function selectProvider(provider: string) {
    setSelectedProviderId(provider);
    setCredentialDraft({});
    setProviderFeedback(null);
  }

  function updateCredentialField(name: string, value: string) {
    setCredentialDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveSelectedProviderKey() {
    if (!selectedProvider) {
      return;
    }

    const missingField = selectedProvider.credentialFields?.find((field) => {
      return !credentialDraft[field.name]?.trim();
    });

    if (missingField) {
      setProviderFeedback({
        tone: 'error',
        message: `${missingField.label}를 입력해 주세요.`,
      });

      return;
    }

    try {
      setSavingProviderId(selectedProvider.provider);
      const status = await importsService.saveProviderKey(
        selectedProvider.provider,
        credentialDraft,
      );

      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === status.provider
            ? { ...entry, ...status, configured: true }
            : entry,
        ),
      );
      setCredentialDraft({});
      setProviderFeedback({
        tone: 'success',
        message: `${selectedProvider.label ?? selectedProvider.provider} API key를 저장했습니다.`,
      });
    } catch (error) {
      setProviderFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : `${selectedProvider.label ?? selectedProvider.provider} API key를 저장하지 못했습니다.`,
      });
    } finally {
      setSavingProviderId(null);
    }
  }

  async function deleteSelectedProviderKey() {
    if (!selectedProvider) {
      return;
    }

    try {
      setDeletingProviderId(selectedProvider.provider);
      await importsService.deleteProviderKey(selectedProvider.provider);
      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === selectedProvider.provider
            ? { ...entry, configured: false }
            : entry,
        ),
      );
      setCredentialDraft({});
      setProviderFeedback({
        tone: 'success',
        message: `${selectedProvider.label ?? selectedProvider.provider} API key를 삭제했습니다.`,
      });
    } catch (error) {
      setProviderFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : `${selectedProvider.label ?? selectedProvider.provider} API key를 삭제하지 못했습니다.`,
      });
    } finally {
      setDeletingProviderId(null);
    }
  }

  return {
    credentialDraft,
    deletingProviderId,
    isLoadingProviderStatuses,
    keyManagedProviders,
    providerFeedback,
    providerStatuses,
    saveSelectedProviderKey,
    savingProviderId,
    selectedProvider,
    selectedProviderId,
    selectProvider,
    deleteSelectedProviderKey,
    updateCredentialField,
  };
}
