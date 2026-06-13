import { useEffect, useMemo, useState } from 'react';

import {
  importsService,
  type ImportProviderStatus,
} from '@features/imports';
import { appI18n } from '@app/i18n';

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
  const [testingProviderId, setTestingProviderId] = useState<string | null>(
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
                : appI18n.t('imports.readiness.loadError'),
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
        message: appI18n.t('imports.providerSettings.fieldRequired', {
          label: missingField.label,
        }),
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
        message: appI18n.t('imports.providerSettings.saveSuccess', {
          label: selectedProvider.label ?? selectedProvider.provider,
        }),
      });
    } catch (error) {
      setProviderFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('imports.providerSettings.saveError', {
                label: selectedProvider.label ?? selectedProvider.provider,
              }),
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
        message: appI18n.t('imports.providerSettings.deleteSuccess', {
          label: selectedProvider.label ?? selectedProvider.provider,
        }),
      });
    } catch (error) {
      setProviderFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('imports.providerSettings.deleteError', {
                label: selectedProvider.label ?? selectedProvider.provider,
              }),
      });
    } finally {
      setDeletingProviderId(null);
    }
  }

  async function testSelectedProviderKey() {
    if (!selectedProvider || !selectedProvider.configured) {
      setProviderFeedback({
        tone: 'error',
        message: appI18n.t('imports.providerSettings.keyRequiredForTest'),
      });

      return;
    }

    try {
      setTestingProviderId(selectedProvider.provider);
      const result = await importsService.testProviderKey(
        selectedProvider.provider,
      );
      const label = selectedProvider.label ?? selectedProvider.provider;

      setProviderFeedback({
        tone: result.ok ? 'success' : 'error',
        message: result.ok
          ? appI18n.t('imports.providerSettings.testSuccess', { label })
          : getProviderKeyTestFailureMessage(result.reason, label),
      });
    } catch (error) {
      setProviderFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('imports.providerSettings.testError', {
                label: selectedProvider.label ?? selectedProvider.provider,
              }),
      });
    } finally {
      setTestingProviderId(null);
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
    testingProviderId,
    testSelectedProviderKey,
    updateCredentialField,
  };
}

function getProviderKeyTestFailureMessage(reason: string | null, label: string) {
  switch (reason) {
    case 'missing_key':
      return appI18n.t('imports.providerSettings.testMissingKey', { label });
    case 'unauthorized':
      return appI18n.t('imports.providerSettings.testUnauthorized', { label });
    case 'provider_unavailable':
      return appI18n.t('imports.providerSettings.testProviderUnavailable', {
        label,
      });
    case 'unknown':
    default:
      return appI18n.t('imports.providerSettings.testError', { label });
  }
}
