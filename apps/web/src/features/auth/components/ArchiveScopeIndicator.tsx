import { useAppTranslation } from '@app/i18n';
import { useAuthSession } from '../hooks/useAuthSession';
import { getUserAvatarProfile } from '../utils/user-profile';
import styles from './ArchiveScopeIndicator.module.css';

interface ArchiveScopeIndicatorProps {
  className?: string;
}

export function ArchiveScopeIndicator({
  className,
}: ArchiveScopeIndicatorProps) {
  const { t } = useAppTranslation();
  const { isLoading, mode, sessionStatus, user } = useAuthSession();

  if (isLoading || sessionStatus === 'restoring') {
    return null;
  }

  const isAccountArchive = mode === 'authenticated' && user !== null;
  const owner = isAccountArchive
    ? t('navigation.archiveScope.accountOwner', {
        name: getUserAvatarProfile(user).displayName,
      })
    : t('navigation.archiveScope.guestOwner');
  const status = t(`navigation.archiveScope.status.${sessionStatus}`);

  return (
    <div
      aria-label={t('navigation.archiveScope.ariaLabel', { owner, status })}
      className={className ? `${styles.scope} ${className}` : styles.scope}
      data-session-status={sessionStatus}
      role="status"
    >
      <span aria-hidden="true" className={styles.dot} />
      <span className={styles.owner}>{owner}</span>
      <span aria-hidden="true">·</span>
      <span className={styles.status}>{status}</span>
    </div>
  );
}
