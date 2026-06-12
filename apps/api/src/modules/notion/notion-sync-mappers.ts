import {
  ProgressUnit,
  WorkStatus,
  type Prisma,
} from '@prisma/client';

import { normalizePersonalTags, normalizeString } from '../works/work-aggregate';
import type { WorkAggregate } from '../user-records/user-records.types';

const MAX_RICH_TEXT_CONTENT_LENGTH = 1900;

export const NOTION_PROVIDER = 'notion';

export const PROPERTY_NAMES = {
  completedAt: 'Completed At',
  droppedAt: 'Dropped At',
  favorite: 'Favorite',
  lastLocalUpdatedAt: 'Last Local Updated At',
  progressCurrent: 'Progress Current',
  progressTotal: 'Progress Total',
  progressUnit: 'Progress Unit',
  rating: 'Rating',
  review: 'Review',
  shortReview: 'Short Review',
  startedAt: 'Started At',
  status: 'Status',
  tags: 'Tags',
  title: 'Title',
  type: 'Type',
  workArchiveId: 'Work Archive ID',
} as const;

const STATUS_TO_NOTION_LABEL: Record<WorkStatus, string> = {
  [WorkStatus.planned]: '예정',
  [WorkStatus.in_progress]: '진행 중',
  [WorkStatus.on_hold]: '보류',
  [WorkStatus.completed]: '완료',
  [WorkStatus.dropped]: '중단',
};

const NOTION_STATUS_TO_WORK_STATUS = new Map<string, WorkStatus>([
  ['planned', WorkStatus.planned],
  ['예정', WorkStatus.planned],
  ['in_progress', WorkStatus.in_progress],
  ['진행 중', WorkStatus.in_progress],
  ['진행중', WorkStatus.in_progress],
  ['on_hold', WorkStatus.on_hold],
  ['보류', WorkStatus.on_hold],
  ['completed', WorkStatus.completed],
  ['완료', WorkStatus.completed],
  ['dropped', WorkStatus.dropped],
  ['중단', WorkStatus.dropped],
]);

const TYPE_LABELS: Record<string, string> = {
  anime: '애니',
  drama: '드라마',
  light_novel: '라이트노벨',
  manga: '만화',
  movie: '영화',
  novel: '소설',
  other: '기타',
  web_novel: '웹소설',
  webtoon: '웹툰',
};

export type NotionConnectionPayload = {
  dataSourceId: string;
  token: string;
};

type NotionPropertyKind =
  | 'checkbox'
  | 'date'
  | 'multi_select'
  | 'number'
  | 'rich_text'
  | 'select'
  | 'status'
  | 'title'
  | string;

export type NotionDataSourceSchema = Record<
  string,
  { type?: NotionPropertyKind }
>;

export type NotionPage = {
  id: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
  url?: string;
};

export type NotionSafeField =
  | 'completedAt'
  | 'droppedAt'
  | 'favorite'
  | 'personalTags'
  | 'progressCurrent'
  | 'progressTotal'
  | 'progressUnit'
  | 'rating'
  | 'review'
  | 'shortReview'
  | 'startedAt'
  | 'status';

type NotionSafeValues = Partial<{
  completedAt: string | null;
  droppedAt: string | null;
  favorite: boolean;
  personalTags: string[];
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: ProgressUnit | null;
  rating: number | null;
  review: string;
  shortReview: string;
  startedAt: string | null;
  status: WorkStatus;
}>;

export interface NotionChangePreview {
  changes: Array<{
    field: NotionSafeField;
    localValue: unknown;
    notionValue: unknown;
  }>;
  lastNotionEditedAt: string | null;
  notionPageId: string;
  title: string;
  workId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncateNotionText(value: string) {
  return value.slice(0, MAX_RICH_TEXT_CONTENT_LENGTH);
}

function toDateOnly(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function normalizeNotionDataSourceId(value: string) {
  return value.trim().replaceAll('-', '');
}

export function getNotionCatalogTitle(work: WorkAggregate) {
  return work.catalogTitle?.displayTitle ?? work.catalogWork.title;
}

function getWorkMediumType(work: WorkAggregate) {
  return work.catalogTitle?.mediumType ?? work.catalogWork.type;
}

function getPropertyType(schema: NotionDataSourceSchema, name: string) {
  return schema[name]?.type ?? null;
}

function hasProperty(schema: NotionDataSourceSchema, name: string) {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

function richTextValue(value: string) {
  const content = truncateNotionText(value.trim());

  return content ? [{ text: { content } }] : [];
}

function dateProperty(value: Date | null | undefined) {
  return value
    ? {
        start: value.toISOString().slice(0, 10),
      }
    : null;
}

function dateTimeProperty(value: Date | null | undefined) {
  return value
    ? {
        start: value.toISOString(),
      }
    : null;
}

function readRichTextProperty(property: unknown) {
  if (!isRecord(property)) {
    return null;
  }

  const values =
    Array.isArray(property.rich_text)
      ? property.rich_text
      : Array.isArray(property.title)
        ? property.title
        : null;

  if (!values) {
    return null;
  }

  return values
    .map((entry) =>
      isRecord(entry) && typeof entry.plain_text === 'string'
        ? entry.plain_text
        : '',
    )
    .join('')
    .trim();
}

function readSelectName(property: unknown) {
  if (!isRecord(property)) {
    return null;
  }

  const select = isRecord(property.select)
    ? property.select
    : isRecord(property.status)
      ? property.status
      : null;

  return typeof select?.name === 'string' ? select.name.trim() : null;
}

function readCheckbox(property: unknown) {
  return isRecord(property) && typeof property.checkbox === 'boolean'
    ? property.checkbox
    : null;
}

function readNumber(property: unknown) {
  return isRecord(property) && typeof property.number === 'number'
    ? property.number
    : null;
}

function readRating(property: unknown) {
  const rating = readNumber(property);

  if (rating === null) {
    return null;
  }

  return rating >= 0 && rating <= 5 ? rating : undefined;
}

function readProgressInteger(property: unknown) {
  const value = readNumber(property);

  if (value === null) {
    return null;
  }

  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readDate(property: unknown) {
  if (!isRecord(property) || !isRecord(property.date)) {
    return null;
  }

  return typeof property.date.start === 'string' ? property.date.start : null;
}

function readMultiSelect(property: unknown) {
  if (!isRecord(property) || !Array.isArray(property.multi_select)) {
    return null;
  }

  return property.multi_select
    .map((entry) =>
      isRecord(entry) && typeof entry.name === 'string' ? entry.name.trim() : '',
    )
    .filter(Boolean);
}

function parseProgressUnit(value: string | null) {
  if (value === ProgressUnit.volume) {
    return ProgressUnit.volume;
  }

  if (value === ProgressUnit.episode || value === '에피소드') {
    return ProgressUnit.episode;
  }

  if (value === ProgressUnit.chapter || value === '화') {
    return ProgressUnit.chapter;
  }

  if (value === '권') {
    return ProgressUnit.volume;
  }

  return null;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setProperty(
  output: Record<string, unknown>,
  schema: NotionDataSourceSchema,
  name: string,
  value: unknown,
) {
  if (hasProperty(schema, name)) {
    output[name] = value;
  }
}

function findTitlePropertyName(schema: NotionDataSourceSchema) {
  return Object.entries(schema).find(([, property]) => {
    return property?.type === 'title';
  })?.[0];
}

function getStatusPropertyKind(schema: NotionDataSourceSchema) {
  return getPropertyType(schema, PROPERTY_NAMES.status) === 'status'
    ? 'status'
    : 'select';
}

export function isUsableNotionSchema(schema: NotionDataSourceSchema) {
  return Object.values(schema).some((property) => property?.type === 'title');
}

export function buildNotionProperties(
  work: WorkAggregate,
  schema: NotionDataSourceSchema,
) {
  const properties: Record<string, unknown> = {};
  const titlePropertyName = findTitlePropertyName(schema) ?? PROPERTY_NAMES.title;
  properties[titlePropertyName] = {
    title: richTextValue(getNotionCatalogTitle(work)),
  };

  setProperty(properties, schema, PROPERTY_NAMES.workArchiveId, {
    rich_text: richTextValue(work.id),
  });
  setProperty(properties, schema, PROPERTY_NAMES.type, {
    select: {
      name: TYPE_LABELS[getWorkMediumType(work)] ?? getWorkMediumType(work),
    },
  });
  setProperty(properties, schema, PROPERTY_NAMES.status, {
    [getStatusPropertyKind(schema)]: {
      name: STATUS_TO_NOTION_LABEL[work.status],
    },
  });
  setProperty(properties, schema, PROPERTY_NAMES.rating, {
    number: work.rating,
  });
  setProperty(properties, schema, PROPERTY_NAMES.favorite, {
    checkbox: work.favorite,
  });
  setProperty(properties, schema, PROPERTY_NAMES.tags, {
    multi_select: work.personalTags.map((name) => ({ name })),
  });
  setProperty(properties, schema, PROPERTY_NAMES.shortReview, {
    rich_text: richTextValue(work.shortReview),
  });
  setProperty(properties, schema, PROPERTY_NAMES.review, {
    rich_text: richTextValue(work.review),
  });
  setProperty(properties, schema, PROPERTY_NAMES.progressCurrent, {
    number: work.progressCurrent,
  });
  setProperty(properties, schema, PROPERTY_NAMES.progressTotal, {
    number: work.progressTotal,
  });
  setProperty(properties, schema, PROPERTY_NAMES.progressUnit, {
    select: work.progressUnit ? { name: work.progressUnit } : null,
  });
  setProperty(properties, schema, PROPERTY_NAMES.startedAt, {
    date: dateProperty(work.startedAt),
  });
  setProperty(properties, schema, PROPERTY_NAMES.completedAt, {
    date: dateProperty(work.completedAt),
  });
  setProperty(properties, schema, PROPERTY_NAMES.droppedAt, {
    date: dateProperty(work.droppedAt),
  });
  setProperty(properties, schema, PROPERTY_NAMES.lastLocalUpdatedAt, {
    date: dateTimeProperty(work.updatedAt),
  });

  return properties;
}

export function readSafeValuesFromNotionPage(
  page: NotionPage,
  schema: NotionDataSourceSchema,
): NotionSafeValues {
  const properties = page.properties ?? {};
  const statusName = readSelectName(properties[PROPERTY_NAMES.status]);
  const progressUnitName = readSelectName(
    properties[PROPERTY_NAMES.progressUnit],
  );
  const values: NotionSafeValues = {};

  if (hasProperty(schema, PROPERTY_NAMES.status) && statusName) {
    const status = NOTION_STATUS_TO_WORK_STATUS.get(statusName);

    if (status) {
      values.status = status;
    }
  }

  if (hasProperty(schema, PROPERTY_NAMES.rating)) {
    const rating = readRating(properties[PROPERTY_NAMES.rating]);

    if (rating !== undefined) {
      values.rating = rating;
    }
  }

  if (hasProperty(schema, PROPERTY_NAMES.favorite)) {
    values.favorite = readCheckbox(properties[PROPERTY_NAMES.favorite]) ?? false;
  }

  if (hasProperty(schema, PROPERTY_NAMES.tags)) {
    values.personalTags = readMultiSelect(properties[PROPERTY_NAMES.tags]) ?? [];
  }

  if (hasProperty(schema, PROPERTY_NAMES.shortReview)) {
    values.shortReview =
      readRichTextProperty(properties[PROPERTY_NAMES.shortReview]) ?? '';
  }

  if (hasProperty(schema, PROPERTY_NAMES.review)) {
    values.review = readRichTextProperty(properties[PROPERTY_NAMES.review]) ?? '';
  }

  if (hasProperty(schema, PROPERTY_NAMES.progressCurrent)) {
    const progressCurrent = readProgressInteger(
      properties[PROPERTY_NAMES.progressCurrent],
    );

    if (progressCurrent !== undefined) {
      values.progressCurrent = progressCurrent;
    }
  }

  if (hasProperty(schema, PROPERTY_NAMES.progressTotal)) {
    const progressTotal = readProgressInteger(
      properties[PROPERTY_NAMES.progressTotal],
    );

    if (progressTotal !== undefined) {
      values.progressTotal = progressTotal;
    }
  }

  if (hasProperty(schema, PROPERTY_NAMES.progressUnit)) {
    values.progressUnit = parseProgressUnit(progressUnitName);
  }

  if (hasProperty(schema, PROPERTY_NAMES.startedAt)) {
    values.startedAt = readDate(properties[PROPERTY_NAMES.startedAt]);
  }

  if (hasProperty(schema, PROPERTY_NAMES.completedAt)) {
    values.completedAt = readDate(properties[PROPERTY_NAMES.completedAt]);
  }

  if (hasProperty(schema, PROPERTY_NAMES.droppedAt)) {
    values.droppedAt = readDate(properties[PROPERTY_NAMES.droppedAt]);
  }

  return values;
}

export function diffNotionSafeValues(
  work: WorkAggregate,
  notionValues: NotionSafeValues,
) {
  const localValues: NotionSafeValues = {
    completedAt: toDateOnly(work.completedAt),
    droppedAt: toDateOnly(work.droppedAt),
    favorite: work.favorite,
    personalTags: work.personalTags,
    progressCurrent: work.progressCurrent,
    progressTotal: work.progressTotal,
    progressUnit: work.progressUnit,
    rating: work.rating,
    review: work.review,
    shortReview: work.shortReview,
    startedAt: toDateOnly(work.startedAt),
    status: work.status,
  };
  const changes: NotionChangePreview['changes'] = [];

  for (const [field, notionValue] of Object.entries(notionValues) as Array<
    [NotionSafeField, unknown]
  >) {
    const localValue = localValues[field];

    if (!valuesEqual(localValue, notionValue)) {
      changes.push({ field, localValue, notionValue });
    }
  }

  return changes;
}

export function buildNotionPullUpdateData(
  changes: NotionChangePreview['changes'],
): Prisma.UserWorkRecordUpdateManyMutationInput {
  const data: Prisma.UserWorkRecordUpdateManyMutationInput = {};

  for (const change of changes) {
    switch (change.field) {
      case 'completedAt':
      case 'droppedAt':
      case 'startedAt':
        data[change.field] = parseNullableNotionDate(change.notionValue);
        break;
      case 'favorite':
        data.favorite = Boolean(change.notionValue);
        break;
      case 'personalTags':
        data.personalTags = normalizePersonalTags(
          Array.isArray(change.notionValue) ? change.notionValue : [],
        );
        break;
      case 'progressCurrent':
      case 'progressTotal':
        data[change.field] =
          typeof change.notionValue === 'number' ? change.notionValue : null;
        break;
      case 'progressUnit':
        data.progressUnit =
          typeof change.notionValue === 'string'
            ? parseProgressUnit(change.notionValue)
            : null;
        break;
      case 'rating':
        data.rating =
          typeof change.notionValue === 'number' ? change.notionValue : null;
        break;
      case 'review':
      case 'shortReview':
        data[change.field] =
          typeof change.notionValue === 'string'
            ? normalizeString(change.notionValue)
            : '';
        break;
      case 'status':
        if (typeof change.notionValue === 'string') {
          const status = NOTION_STATUS_TO_WORK_STATUS.get(change.notionValue);

          if (status) {
            data.status = status;
          }
        }
        break;
    }
  }

  return data;
}

export function parseNotionEditedTime(page: NotionPage) {
  return page.last_edited_time ? new Date(page.last_edited_time) : null;
}

export function parseNullableNotionDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
