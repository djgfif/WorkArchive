import { useEffect, useMemo, useState } from 'react';

import type { ImportProviderStatus } from '@work-archive/shared-types';

import { useAuthSession } from '../../auth/hooks/useAuthSession';
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
      label: '사용 가능',
      providers: searchableProviders.filter(
        (provider) =>
          provider.configured && provider.circuitState !== 'open',
      ),
    },
    circuitOpen: {
      label: '일시 중단',
      providers: searchableProviders.filter(
        (provider) => provider.circuitState === 'open',
      ),
    },
    directFallback: {
      label: '직접 추가',
      providers: directFallbackProviders,
    },
    serverSetupRequired: {
      label: '서버 설정 필요',
      providers: searchableProviders.filter(
        (provider) =>
          provider.credentialMode === 'server' && provider.configured === false,
      ),
    },
    userActionRequired: {
      label: authMode === 'guest' ? '로그인 후 사용' : '사용자 키 필요',
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
            : '검색 provider 상태를 불러오지 못했습니다.',
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
