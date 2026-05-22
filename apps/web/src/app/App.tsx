import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '../features/auth/context/AuthProvider';
import { AutoSyncRuntime } from '../features/sync/components/AutoSyncRuntime';
import { queryClient } from './query-client';
import { AppRouter } from './router/AppRouter';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AutoSyncRuntime />
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
