import type {
  WorkImportDraft,
  WorkRecord,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import { getGraphTags, getPersonalTags } from './graph-tags';
import type { WorkGraphInput, WorkGraphSnapshot } from '../services/graph.repository';

export interface WorkFormValues {
  type: WorkType;
  title: string;
  author: string;
  genresText: string;
  personalTagsText: string;
  seriesText: string;
  universeText: string;
  creatorText: string;
  studioText: string;
  publisherText: string;
  platformText: string;
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: string;
  shortReview: string;
  review: string;
  favorite: boolean;
  startedAt: string;
  completedAt: string;
  droppedAt: string;
  lastConsumedAt: string;
}

export interface UpsertWorkInput {
  catalogTitleId?: string | null;
  importDraft?: WorkImportDraft | null;
  type: WorkType;
  title: string;
  author: string;
  genres: string[];
  personalTags?: string[];
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  favorite: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  droppedAt?: string | null;
  lastConsumedAt?: string | null;
  graph?: WorkGraphInput;
}

export function createDefaultWorkFormValues(): WorkFormValues {
  return {
    type: 'novel',
    title: '',
    author: '',
    genresText: '',
    personalTagsText: '',
    seriesText: '',
    universeText: '',
    creatorText: '',
    studioText: '',
    publisherText: '',
    platformText: '',
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: '',
    shortReview: '',
    review: '',
    favorite: false,
    startedAt: '',
    completedAt: '',
    droppedAt: '',
    lastConsumedAt: '',
  };
}

function formatIsoDateForInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function createWorkFormValuesFromRecord(
  work: WorkRecord,
  graph?: WorkGraphSnapshot,
): WorkFormValues {
  const getSeriesTitlesByKind = (kind: 'series' | 'universe') =>
    graph?.workSeriesLinks && graph.workSeriesLinks.length > 0
      ? graph.workSeriesLinks
          .map((link) =>
            graph.series.find((series) => series.id === link.seriesId),
          )
          .filter((series): series is NonNullable<typeof series> =>
            Boolean(series && series.kind === kind),
          )
          .map((series) => series.title)
      : getGraphTags(work.personalTags)
          .filter((tag) => tag.kind === kind)
          .map((tag) => tag.value);
  const getContributorNamesByRole = (role: string) =>
    graph?.workContributors && graph.workContributors.length > 0
      ? graph.workContributors
          .filter((link) => link.role === role)
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((link) =>
            graph.contributors.find(
              (contributor) => contributor.id === link.contributorId,
            ),
          )
          .filter(
            (contributor): contributor is NonNullable<typeof contributor> =>
              Boolean(contributor),
          )
          .map((contributor) => contributor.name)
      : getGraphTags(work.personalTags)
          .filter((tag) => {
            if (role === 'original_creator') return tag.kind === 'creator';
            if (role === 'studio') return tag.kind === 'studio';
            if (role === 'publisher') return tag.kind === 'publisher';
            if (role === 'platform') return tag.kind === 'platform';

            return false;
          })
          .map((tag) => tag.value);

  return {
    type: work.type,
    title: work.title,
    author: work.author,
    genresText: work.genres.join(', '),
    personalTagsText: getPersonalTags(work.personalTags).join(', '),
    seriesText: getSeriesTitlesByKind('series').join(', '),
    universeText: getSeriesTitlesByKind('universe').join(', '),
    creatorText: getContributorNamesByRole('original_creator').join(', '),
    studioText: getContributorNamesByRole('studio').join(', '),
    publisherText: getContributorNamesByRole('publisher').join(', '),
    platformText: getContributorNamesByRole('platform').join(', '),
    description: work.description,
    thumbnailUrl: work.thumbnailUrl,
    status: work.status,
    rating: work.rating?.toString() ?? '',
    shortReview: work.shortReview,
    review: work.review,
    favorite: work.favorite,
    startedAt: formatIsoDateForInput(work.startedAt),
    completedAt: formatIsoDateForInput(work.completedAt),
    droppedAt: formatIsoDateForInput(work.droppedAt),
    lastConsumedAt: formatIsoDateForInput(work.lastConsumedAt),
  };
}

export function createUpsertWorkInputFromRecord(
  work: WorkRecord,
): UpsertWorkInput {
  return {
    catalogTitleId: work.catalogTitleId ?? null,
    importDraft: work.importDraft ?? null,
    type: work.type,
    title: work.title,
    author: work.author,
    genres: work.genres,
    personalTags: work.personalTags,
    description: work.description,
    thumbnailUrl: work.thumbnailUrl,
    status: work.status,
    rating: work.rating,
    shortReview: work.shortReview,
    review: work.review,
    favorite: work.favorite,
    startedAt: work.startedAt ?? null,
    completedAt: work.completedAt ?? null,
    droppedAt: work.droppedAt ?? null,
    lastConsumedAt: work.lastConsumedAt ?? null,
  };
}

export function parseCommaSeparatedTextList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function formatTextListForWorkForm(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).join(', ');
}

function parseOptionalDateInput(value: string, fieldLabel: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel}을 올바른 날짜로 입력해주세요.`);
  }

  return parsed.toISOString();
}

export function parseWorkFormValues(values: WorkFormValues): UpsertWorkInput {
  const title = values.title.trim();

  if (!title) {
    throw new Error('제목을 입력해주세요.');
  }

  const parsedRating =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);

  if (
    parsedRating !== null &&
    (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5)
  ) {
    throw new Error('별점은 0점부터 5점 사이로 입력해주세요.');
  }

  const personalTags = getPersonalTags(
    parseCommaSeparatedTextList(values.personalTagsText),
  );
  const graph: WorkGraphInput = {
    series: [
      ...parseCommaSeparatedTextList(values.seriesText).map((seriesTitle) => ({
        kind: 'series' as const,
        role: 'main' as const,
        title: seriesTitle,
      })),
      ...parseCommaSeparatedTextList(values.universeText).map((seriesTitle) => ({
        kind: 'universe' as const,
        role: 'main' as const,
        title: seriesTitle,
      })),
    ],
    contributors: [
      ...parseCommaSeparatedTextList(values.creatorText).map((name, index) => ({
        displayOrder: index,
        entityType: 'person' as const,
        name,
        role: 'original_creator' as const,
      })),
      ...parseCommaSeparatedTextList(values.studioText).map((name, index) => ({
        displayOrder: index,
        entityType: 'organization' as const,
        name,
        role: 'studio' as const,
      })),
      ...parseCommaSeparatedTextList(values.publisherText).map((name, index) => ({
        displayOrder: index,
        entityType: 'organization' as const,
        name,
        role: 'publisher' as const,
      })),
      ...parseCommaSeparatedTextList(values.platformText).map((name, index) => ({
        displayOrder: index,
        entityType: 'organization' as const,
        name,
        role: 'platform' as const,
      })),
    ],
  };

  return {
    type: values.type,
    title,
    author: values.author.trim(),
    genres: parseCommaSeparatedTextList(values.genresText),
    personalTags,
    description: values.description.trim(),
    thumbnailUrl: values.thumbnailUrl.trim(),
    status: values.status,
    rating: parsedRating,
    shortReview: values.shortReview.trim(),
    review: values.review.trim(),
    favorite: values.favorite,
    startedAt: parseOptionalDateInput(values.startedAt, 'startedAt'),
    completedAt: parseOptionalDateInput(values.completedAt, 'completedAt'),
    droppedAt: parseOptionalDateInput(values.droppedAt, 'droppedAt'),
    lastConsumedAt: parseOptionalDateInput(
      values.lastConsumedAt,
      'lastConsumedAt',
    ),
    graph,
  };
}
