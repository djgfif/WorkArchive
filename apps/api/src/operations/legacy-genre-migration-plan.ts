import { moveUnknownGenresToPersonalTags } from '@work-archive/shared-types';

export interface LegacyGenreMigrationWork {
  genres: string[];
  id: string;
  userRecords: Array<{
    id: string;
    personalTags: string[];
  }>;
}

export interface LegacyGenreMigrationWorkPlan {
  catalogWorkId: string;
  changedCatalogWork: boolean;
  changedUserRecords: Array<{
    id: string;
    personalTags: string[];
  }>;
  genres: string[];
  movedTags: string[];
}

export function buildLegacyGenreMigrationWorkPlan(
  work: LegacyGenreMigrationWork,
): LegacyGenreMigrationWorkPlan {
  const normalizedCatalog = moveUnknownGenresToPersonalTags(work.genres);
  const changedUserRecords = work.userRecords
    .map((record) => ({
      id: record.id,
      personalTags: moveUnknownGenresToPersonalTags(
        work.genres,
        record.personalTags,
      ).personalTags,
    }))
    .filter((record) => {
      const current = work.userRecords.find((entry) => entry.id === record.id);

      return current
        ? !arraysEqual(current.personalTags, record.personalTags)
        : false;
    });

  return {
    catalogWorkId: work.id,
    changedCatalogWork:
      normalizedCatalog.personalTags.length > 0 ||
      !arraysEqual(work.genres, normalizedCatalog.genres),
    changedUserRecords,
    genres: normalizedCatalog.genres,
    movedTags: normalizedCatalog.personalTags,
  };
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
