import { useEffect, useMemo, useState } from 'react';

import type { ImportProviderStatus } from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { importsService } from '../services/imports.service';

export interface ProviderReadinessGroup {
  label: string;
  providers: ImportProviderStatus[];
}

export interface ImportProviderReadiness {
  available: ProviderReadinessGroup;
  circuitOpen: ProviderReadinessGroup;
  directFallback: ProviderReadinessGroup;
  serverSetupRequired: ProviderReadinessGroup;
  userActionRequired: ProviderReadinessGroup;
}

const DIRECT_FALLBACK_PROVIDER = 'manual';

function getProviderLabel(provider: ImportProviderStatus) {
  return provider.label ?? provider.provider;
}

function createProviderReadiness(
  providers: ImportProviderStatus[],
  authMode: 'authenticated' | 'guest',
): ImportProviderReadiness {
  const directFallbackProviders = providers.filter(
    (provider) => provider.provider === DIRECT_FALLBACK_PROVIDER,
  );
  const searchableProviders = providers.filter(
    (provider) => provider.provider !== DIRECT_FALLBACK_PROVIDER,
  );

  return {
    available: {
      label: appI18n.t('imports.readiness.available'),
      providers: searchableProviders.filter(
        (provider) =>
          provider.configured && provider.circuitState !== 'open',
      ),
    },
    circuitOpen: {
      label: appI18n.t('imports.readiness.circuitOpen'),
      providers: searchableProviders.filter(
        (provider) => provider.circuitState === 'open',
      ),
    },
    directFallback: {
      label: appI18n.t('imports.readiness.directFallback'),
      providers: directFallbackProviders,
    },
    serverSetupRequired: {
      label: appI18n.t('imports.readiness.serverSetupRequired'),
      providers: searchableProviders.filter(
        (provider) =>
          provider.credentialMode === 'server' && provider.configured === false,
      ),
    },
    userActionRequired: {
      label:
        authMode === 'guest'
          ? appI18n.t('imports.readiness.loginRequired')
          : appI18n.t('imports.readiness.userKeyRequired'),
      providers: searchableProviders.filter(
        (provider) =>
          provider.credentialMode === 'user' && provider.configured === false,
      ),
    },
  };
}

export function formatProviderNames(providers: ImportProviderStatus[]) {
  return providers.map(getProviderLabel).join(', ');
}

export function useImportProviderReadiness(enabled: boolean) {
  const { archiveScopeKey, mode } = useAuthSession();
  const [providers, setProviders] = useState<ImportProviderStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;

    setIsLoading(true);
    setError(null);

    importsService
      .listProviders()
      .then((nextProviders) => {
        if (!isCurrent) {
          return;
        }

        setProviders(Array.isArray(nextProviders) ? nextProviders : []);
      })
      .catch((nextError: unknown) => {
        if (!isCurrent) {
          return;
        }

        setProviders([]);
        setError(
          nextError instanceof Error
            ? nextError.message
            : appI18n.t('imports.readiness.loadError'),
        );
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [archiveScopeKey, enabled]);

  const readiness = useMemo(
    () =>
      createProviderReadiness(
        providers,
        mode === 'authenticated' ? 'authenticated' : 'guest',
      ),
    [mode, providers],
  );

  return {
    error,
    isLoading,
    providers,
    readiness,
  };
}
