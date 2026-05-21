import type { WorkAggregate } from './user-records.types';
import { toWorkSyncStatusValue } from '../works/works.constants';

export function toUserWorkRecordView(work: WorkAggregate) {
  const title = work.catalogTitle;

  return {
    record: {
      id: work.id,
      status: work.status,
      rating: work.rating,
      shortReview: work.shortReview,
      review: work.review,
      favorite: work.favorite,
      personalTags: work.personalTags,
      progressCurrent: work.progressCurrent,
      progressTotal: work.progressTotal,
      progressUnit: work.progressUnit,
      lastConsumedLabel: work.lastConsumedLabel,
      startedAt: work.startedAt?.toISOString() ?? null,
      completedAt: work.completedAt?.toISOString() ?? null,
      droppedAt: work.droppedAt?.toISOString() ?? null,
      lastConsumedAt: work.lastConsumedAt?.toISOString() ?? null,
      createdAt: work.createdAt.toISOString(),
      updatedAt: work.updatedAt.toISOString(),
      deletedAt: work.deletedAt?.toISOString() ?? null,
      syncStatus: toWorkSyncStatusValue(work.syncStatus),
      serverVersion: work.serverVersion,
    },
    catalog: title
      ? {
          id: title.id,
          mediumType: title.mediumType,
          subType: title.subType,
          title: title.displayTitle,
          originalTitle: title.originalTitle,
          releaseYear: title.releaseYear,
          status: title.status,
          summary: title.summary,
          thumbnailUrl: title.thumbnailUrl,
          verificationStatus: title.verificationStatus,
          franchise: title.franchise
            ? {
                id: title.franchise.id,
                name: title.franchise.displayName,
              }
            : null,
          contributors: title.contributors.map((entry) => ({
            id: entry.contributor.id,
            name: entry.contributor.displayName,
            role: entry.role,
          })),
          relations: title.outgoingRelations.map((relation) => ({
            relationType: relation.relationType,
            targetTitle: relation.targetTitle.displayTitle,
            targetTitleId: relation.targetTitleId,
          })),
          genres: work.catalogWork.genres,
        }
      : {
          id: work.catalogWorkId,
          mediumType: work.catalogWork.type,
          subType: null,
          title: work.catalogWork.title,
          originalTitle: null,
          releaseYear: null,
          status: 'unknown',
          summary: work.catalogWork.description,
          thumbnailUrl: work.catalogWork.thumbnailUrl,
          verificationStatus: 'draft',
          franchise: null,
          contributors: work.catalogWork.author
            ? [
                {
                  id: null,
                  name: work.catalogWork.author,
                  role: 'author',
                },
              ]
            : [],
          relations: [],
          genres: work.catalogWork.genres,
        },
  };
}
