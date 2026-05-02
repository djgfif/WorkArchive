import { AuthProvider } from '../features/auth/context/AuthProvider';
import { AutoSyncRuntime } from '../features/sync/components/AutoSyncRuntime';
import { AppRouter } from './router/AppRouter';

export function App() {
  return (
    <AuthProvider>
      <AutoSyncRuntime />
      <AppRouter />
    </AuthProvider>
  );
}
