import { Navigate } from 'react-router-dom';

export function RegisterPage() {
  return <Navigate replace to="/auth/login" />;
}
