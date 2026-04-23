import type { CatalogRelationType } from '@prisma/client';

import type {
  CatalogRelatedRelationView,
  CatalogTitleView,
} from './catalog.service';

type CatalogTitleSummaryInput =
  | CatalogTitleView
  | Pick<
      CatalogRelatedRelationView['sourceTitle'],
      'displayTitle' | 'franchise' | 'id' | 'mediumType' | 'releaseYear' | 'subType' | 'thumbnailUrl'
    >;

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

export function toCatalogTitleSummaryView(title: CatalogTitleSummaryInput) {
  return {
    id: title.id,
    mediumType: title.mediumType,
    subType: title.subType,
    thumbnailUrl: title.thumbnailUrl,
    title: title.displayTitle,
    releaseYear: title.releaseYear,
    franchise: title.franchise
      ? {
          id: title.franchise.id,
          name: title.franchise.displayName,
        }
      : null,
  };
}

export function toCatalogRelatedTitleView(
  title: CatalogTitleSummaryInput,
  relation?: {
    relationDirection: 'incoming' | 'outgoing';
    relationType: CatalogRelationType;
  } | null,
) {
  return {
    ...toCatalogTitleSummaryView(title),
    relationDirection: relation?.relationDirection ?? null,
    relationType: relation?.relationType ?? null,
  };
}

export function toCatalogRelationView(
  currentTitleId: string,
  relation: CatalogRelatedRelationView,
) {
  const isOutgoing = relation.sourceTitleId === currentTitleId;
  const targetTitle = isOutgoing ? relation.targetTitle : relation.sourceTitle;

  return {
    relationDirection: isOutgoing ? 'outgoing' : 'incoming',
    relationType: relation.relationType,
    targetTitle: toCatalogRelatedTitleView(targetTitle, {
      relationDirection: isOutgoing ? 'outgoing' : 'incoming',
      relationType: relation.relationType,
    }),
  };
}
