import { AuthProvider } from '../features/auth/context/AuthProvider';
import { AppRouter } from './router/AppRouter';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
