import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@features/auth';
import { AutoSyncRuntime } from '@features/sync';
import { AppLocaleRuntime } from './i18n';
import { queryClient } from './query-client';
import { AppRouter } from './router/AppRouter';
import { LocalDataSafetyRuntime } from './runtime/LocalDataSafetyRuntime';
import { PwaRuntime } from './runtime/PwaRuntime';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLocaleRuntime />
        <AutoSyncRuntime />
        <LocalDataSafetyRuntime />
        <PwaRuntime />
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
