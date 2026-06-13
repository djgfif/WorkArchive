import type { AuthUser } from '../services/auth.api';

import { appI18n } from '@app/i18n';

export interface UserAvatarProfile {
  displayName: string;
  email: string;
  imageUrl: string;
  initial: string;
}

export function getUserAvatarProfile(user: AuthUser | null): UserAvatarProfile {
  const googleAccount = user?.authAccounts?.find((account) => account.provider === 'google');
  const email =
    googleAccount?.email ?? user?.email ?? appI18n.t('auth.userProfile.notSignedIn');
  const displayName =
    user?.nickname?.trim() ||
    googleAccount?.name?.trim() ||
    user?.email ||
    appI18n.t('auth.userProfile.guest');
  const imageUrl = user?.avatarUrl?.trim() || googleAccount?.pictureUrl?.trim() || '';
  const initialSource = displayName || email || 'G';

  return {
    displayName,
    email,
    imageUrl,
    initial: (initialSource[0] ?? 'G').toUpperCase(),
  };
}
