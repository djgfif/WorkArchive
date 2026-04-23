import type { CatalogRelationType } from '@prisma/client';

import type { CatalogTitleView } from './catalog.service';

export function toCatalogTitleView(title: CatalogTitleView) {
  return {
    id: title.id,
    mediumType: title.mediumType,
    subType: title.subType,
    canonicalTitle: title.canonicalTitle,
    displayTitle: title.displayTitle,
    originalTitle: title.originalTitle,
    aliases: title.aliases,
    releaseYear: title.releaseYear,
    startDate: title.startDate,
    endDate: title.endDate,
    country: title.country,
    status: title.status,
    summary: title.summary,
    thumbnailUrl: title.thumbnailUrl,
    verificationStatus: title.verificationStatus,
    franchise: title.franchise
      ? {
          id: title.franchise.id,
          name: title.franchise.displayName,
          canonicalName: title.franchise.canonicalName,
        }
      : null,
    contributors: title.contributors.map((entry) => ({
      id: entry.contributor.id,
      name: entry.contributor.displayName,
      role: entry.role,
      displayOrder: entry.displayOrder,
    })),
    externalRefs: title.externalRefs.map((ref) => ({
      id: ref.id,
      provider: ref.provider,
      externalId: ref.externalId,
      rawType: ref.rawType,
      url: ref.url,
    })),
    createdAt: title.createdAt,
    updatedAt: title.updatedAt,
  };
}

export function toCatalogRelationView(relation: {
  relationType: CatalogRelationType;
  targetTitle: {
    displayTitle: string;
    franchise: {
      displayName: string;
      id: string;
    } | null;
    id: string;
    mediumType: string;
    releaseYear: number | null;
    subType: string | null;
  };
}) {
  return {
    relationType: relation.relationType,
    targetTitle: {
      id: relation.targetTitle.id,
      mediumType: relation.targetTitle.mediumType,
      subType: relation.targetTitle.subType,
      title: relation.targetTitle.displayTitle,
      releaseYear: relation.targetTitle.releaseYear,
      franchise: relation.targetTitle.franchise
        ? {
            id: relation.targetTitle.franchise.id,
            name: relation.targetTitle.franchise.displayName,
          }
        : null,
    },
  };
}
