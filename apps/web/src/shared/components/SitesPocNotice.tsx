import { useAppTranslation } from '@app/i18n';
import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';
import { cx } from '@shared/utils/class-names';

import styles from './SitesPocNotice.module.css';

interface SitesPocNoticeProps {
  topOffset?: 'navigation' | 'page';
}

export function SitesPocNotice({
  topOffset = 'navigation',
}: SitesPocNoticeProps) {
  const { t } = useAppTranslation();

  if (!isSitesGuestPoc()) {
    return null;
  }

  return (
    <div
      aria-label={t('navigation.sitesPocNoticeAria')}
      className={cx(styles.notice, topOffset === 'page' && styles.pageOffset)}
      role="status"
    >
      <span aria-hidden="true" className={styles.dot} />
      <span>{t('navigation.sitesPocNotice')}</span>
    </div>
  );
}
