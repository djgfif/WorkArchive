import type { AuthUser } from '../services/auth.api';

export interface UserAvatarProfile {
  displayName: string;
  email: string;
  imageUrl: string;
  initial: string;
}

export function getUserAvatarProfile(user: AuthUser | null): UserAvatarProfile {
  const googleAccount = user?.authAccounts?.find((account) => account.provider === 'google');
  const email = googleAccount?.email ?? user?.email ?? '로그인되지 않음';
  const displayName =
    user?.nickname?.trim() ||
    googleAccount?.name?.trim() ||
    user?.email ||
    '게스트';
  const imageUrl = user?.avatarUrl?.trim() || googleAccount?.pictureUrl?.trim() || '';
  const initialSource = displayName || email || 'G';

  return {
    displayName,
    email,
    imageUrl,
    initial: (initialSource[0] ?? 'G').toUpperCase(),
  };
}
