import { Link } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  formatWorkDateTime,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorksTrashListProps {
  onRestore: (work: WorkRecord) => Promise<void>;
  restoringWorkId: string | null;
  works: WorkRecord[];
}

export function WorksTrashList({
  onRestore,
  restoringWorkId,
  works,
}: WorksTrashListProps) {
  return (
    <section className="works-section">
      <div className="works-trash-stack">
        {works.map((work) => {
          const isRestoring = restoringWorkId === work.id;
          const typeLabel = getWorkTypeLabel(work.type);

          return (
            <article
              className={isRestoring ? 'works-trash-row works-trash-row--busy' : 'works-trash-row'}
              key={work.id}
            >
              <ArtworkPoster
                thumbnailUrl={work.thumbnailUrl}
                title={work.title}
                typeLabel={typeLabel}
                variant="row"
              />

              <div className="works-trash-row-copy">
                <div className="works-trash-row-header">
                  <div className="stack">
                    <h3 className="card-title">{work.title}</h3>
                    <p className="muted-copy">
                      {work.author || '작가·제작자 미입력'} · 삭제한 날{' '}
                      {formatWorkDateTime(work.deletedAt ?? work.updatedAt)}
                    </p>
                  </div>

                  <div className="badge-row">
                    <span className="badge">{typeLabel}</span>
                    <span className="badge">{getWorkStatusLabel(work.status)}</span>
                    <span className="badge">{getWorkSyncStatusLabel(work.syncStatus)}</span>
                  </div>
                </div>

                <p className="card-summary">
                  {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
                </p>

                <div className="works-trash-row-footer">
                  <p className="works-trash-note">
                    복원하면 다시 작품 목록에 나타나고, 현재 기록 상태도 그대로 유지됩니다.
                  </p>

                  <div className="button-row">
                    <button
                      disabled={isRestoring}
                      onClick={() => void onRestore(work)}
                      type="button"
                    >
                      {isRestoring ? '복원 중...' : '복원'}
                    </button>
                    <Link
                      className="secondary-link"
                      to={`/works?q=${encodeURIComponent(work.title)}`}
                    >
                      비슷한 기록 보기
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
