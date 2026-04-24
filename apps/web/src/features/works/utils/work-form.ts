import type {
  WorkImportDraft,
  WorkRecord,
  WorkStatus,
  WorkTier,
  WorkType,
} from '@work-archive/shared-types';

export interface WorkFormValues {
  type: WorkType;
  title: string;
  author: string;
  genresText: string;
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: string;
  shortReview: string;
  review: string;
  tier: WorkTier | '';
  favorite: boolean;
}

export interface UpsertWorkInput {
  catalogTitleId?: string | null;
  importDraft?: WorkImportDraft | null;
  type: WorkType;
  title: string;
  author: string;
  genres: string[];
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  tier: WorkTier | null;
  favorite: boolean;
}

export function createDefaultWorkFormValues(): WorkFormValues {
  return {
    type: 'novel',
    title: '',
    author: '',
    genresText: '',
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: '',
    shortReview: '',
    review: '',
    tier: '',
    favorite: false,
  };
}

export function createWorkFormValuesFromRecord(
  work: WorkRecord,
): WorkFormValues {
  return {
    type: work.type,
    title: work.title,
    author: work.author,
    genresText: work.genres.join(', '),
    description: work.description,
    thumbnailUrl: work.thumbnailUrl,
    status: work.status,
    rating: work.rating?.toString() ?? '',
    shortReview: work.shortReview,
    review: work.review,
    tier: work.tier ?? '',
    favorite: work.favorite,
  };
}

export function createUpsertWorkInputFromRecord(work: WorkRecord): UpsertWorkInput {
  return {
    catalogTitleId: work.catalogTitleId ?? null,
    importDraft: work.importDraft ?? null,
    type: work.type,
    title: work.title,
    author: work.author,
    genres: work.genres,
    description: work.description,
    thumbnailUrl: work.thumbnailUrl,
    status: work.status,
    rating: work.rating,
    shortReview: work.shortReview,
    review: work.review,
    tier: work.tier,
    favorite: work.favorite,
  };
}

function parseGenres(genresText: string) {
  return Array.from(
    new Set(
      genresText
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );
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

  return {
    type: values.type,
    title,
    author: values.author.trim(),
    genres: parseGenres(values.genresText),
    description: values.description.trim(),
    thumbnailUrl: values.thumbnailUrl.trim(),
    status: values.status,
    rating: parsedRating,
    shortReview: values.shortReview.trim(),
    review: values.review.trim(),
    tier: values.tier || null,
    favorite: values.favorite,
  };
}
