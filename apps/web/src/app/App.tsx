import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@features/auth';
import { AutoSyncRuntime } from '@features/sync';
import { AppLocaleRuntime } from './i18n';
import { queryClient } from './query-client';
import { AppRouter } from './router/AppRouter';
import { LocalDataSafetyRuntime } from './runtime/LocalDataSafetyRuntime';
import { PwaRuntime } from './runtime/PwaRuntime';
import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';

export function App() {
  const sitesGuestPoc = isSitesGuestPoc();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLocaleRuntime />
        {!sitesGuestPoc && <AutoSyncRuntime />}
        <LocalDataSafetyRuntime />
        {!sitesGuestPoc && <PwaRuntime />}
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
