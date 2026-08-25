import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { useAppTranslation } from '@app/i18n';
import { cn } from '@shared/utils/class-names';
import { getWorkTypeLabel } from '../utils/work-options';
import {
  getProgressPercent,
  getWorkContinueLabel,
} from '../utils/work-list-row-state';
import { WorkPoster } from './archive-components/WorkPoster';
import styles from './ArchiveComponents.module.css';

interface WorksContinueShelfProps {
  works: WorkRecord[];
}

export function WorksContinueShelf({ works }: WorksContinueShelfProps) {
  const { t } = useAppTranslation();

  if (works.length === 0) return null;

  return (
    <section
      aria-labelledby="library-continue-title"
      className={cn(styles.libraryContinueSection)}
    >
      <div className={cn(styles.libraryContinueHeader)}>
        <h2 id="library-continue-title">{t('home.shelves.continueTitle')}</h2>
        <Link to="/works?status=in_progress">{t('home.shelf.viewAll')}</Link>
      </div>
      <div
        aria-label={t('home.shelf.trackAria', {
          title: t('home.shelves.continueTitle'),
        })}
        className={cn(styles.libraryContinueTrack)}
      >
        {works.map((work) => {
          const progress = getProgressPercent(work);
          const progressLabel = getWorkContinueLabel(work);

          return (
            <Link
              className={cn(styles.libraryContinueItem)}
              key={work.id}
              to={`/works/${work.id}`}
            >
              <WorkPoster
                className={cn(styles.libraryContinuePoster)}
                coverSeed={work.id}
                showFallbackTitle
                thumbnailUrl={work.thumbnailUrl}
                title={work.title}
                typeLabel={getWorkTypeLabel(work.type)}
                variant="grid"
              />
              <span className={cn(styles.libraryContinueBody)}>
                <strong>{work.title}</strong>
                <span>{progressLabel ?? getWorkTypeLabel(work.type)}</span>
                {progress !== null && (
                  <span
                    aria-label={`${progress}%`}
                    className={cn(styles.libraryContinueProgress)}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
