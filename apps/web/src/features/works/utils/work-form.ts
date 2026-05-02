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
  personalTagsText: string;
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: string;
  shortReview: string;
  review: string;
  tier: WorkTier | '';
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
  tier: WorkTier | null;
  favorite: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  droppedAt?: string | null;
  lastConsumedAt?: string | null;
}

export function createDefaultWorkFormValues(): WorkFormValues {
  return {
    type: 'novel',
    title: '',
    author: '',
    genresText: '',
    personalTagsText: '',
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: '',
    shortReview: '',
    review: '',
    tier: '',
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
): WorkFormValues {
  return {
    type: work.type,
    title: work.title,
    author: work.author,
    genresText: work.genres.join(', '),
    personalTagsText: work.personalTags.join(', '),
    description: work.description,
    thumbnailUrl: work.thumbnailUrl,
    status: work.status,
    rating: work.rating?.toString() ?? '',
    shortReview: work.shortReview,
    review: work.review,
    tier: work.tier ?? '',
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
    tier: work.tier,
    favorite: work.favorite,
    startedAt: work.startedAt ?? null,
    completedAt: work.completedAt ?? null,
    droppedAt: work.droppedAt ?? null,
    lastConsumedAt: work.lastConsumedAt ?? null,
  };
}

function parseCommaSeparatedTextList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
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

  return {
    type: values.type,
    title,
    author: values.author.trim(),
    genres: parseCommaSeparatedTextList(values.genresText),
    personalTags: parseCommaSeparatedTextList(values.personalTagsText),
    description: values.description.trim(),
    thumbnailUrl: values.thumbnailUrl.trim(),
    status: values.status,
    rating: parsedRating,
    shortReview: values.shortReview.trim(),
    review: values.review.trim(),
    tier: values.tier || null,
    favorite: values.favorite,
    startedAt: parseOptionalDateInput(values.startedAt, '시작일'),
    completedAt: parseOptionalDateInput(values.completedAt, '완료일'),
    droppedAt: parseOptionalDateInput(values.droppedAt, '중단일'),
    lastConsumedAt: parseOptionalDateInput(
      values.lastConsumedAt,
      '마지막 감상일',
    ),
  };
}
