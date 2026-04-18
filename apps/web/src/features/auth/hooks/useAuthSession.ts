import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

export function useAuthSession() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuthSession must be used inside AuthProvider.');
  }

  return value;
}
