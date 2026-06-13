import {
  WORK_STATUSES,
  WORK_TYPES,
  type WorkStatus,
  type WorkType,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import type { ExternalImportEntry } from './anilist-user-list.service';

/**
 * 범용 CSV 가져오기.
 *
 * 헤더를 한국어/영어 별칭으로 자동 인식하며, 이 앱의 CSV 내보내기
 * (title, type, status, rating, personalTags, shortReview, review, progress, …)
 * 형식을 그대로 다시 읽을 수 있다.
 */

const HEADER_ALIASES: Record<string, string[]> = {
  author: ['author', 'creator', '작가', '저자', '제작'],
  completedAt: ['completedat', 'finishdate', 'finishedat', '완료일'],
  favorite: ['favorite', 'favourite', '즐겨찾기'],
  personalTags: ['personaltags', 'tags', 'tag', '태그', '개인태그'],
  progress: ['progress', '진행도', '진행'],
  rating: ['rating', 'score', '별점', '평점', '점수'],
  review: ['review', 'comment', 'comments', '감상', '상세감상', '리뷰'],
  shortReview: ['shortreview', '한줄평', '한줄감상'],
  startedAt: ['startedat', 'startdate', '시작일'],
  status: ['status', '상태', '감상상태'],
  thumbnailUrl: [
    'thumbnailurl',
    'thumbnail',
    'cover',
    'coverurl',
    'image',
    'imageurl',
    '표지',
    '표지이미지',
    '표지주소',
  ],
  title: ['title', '제목', '작품명'],
  type: ['type', '유형', '매체', '종류'],
};

const TYPE_ALIASES: Record<string, WorkType> = {
  드라마: 'drama',
  라노벨: 'light_novel',
  라이트노벨: 'light_novel',
  만화: 'manga',
  소설: 'novel',
  애니: 'anime',
  애니메이션: 'anime',
  영화: 'movie',
  웹소설: 'web_novel',
  웹툰: 'webtoon',
  기타: 'other',
};

const STATUS_ALIASES: Record<string, WorkStatus> = {
  계획: 'planned',
  observing: 'in_progress',
  드랍: 'dropped',
  reading: 'in_progress',
  watching: 'in_progress',
  보는중: 'in_progress',
  보류: 'on_hold',
  볼예정: 'planned',
  완결: 'completed',
  완료: 'completed',
  예정: 'planned',
  읽는중: 'in_progress',
  읽을예정: 'planned',
  중단: 'dropped',
  진행중: 'in_progress',
  하차: 'dropped',
};

/** 따옴표·줄바꿈·이스케이프를 처리하는 CSV 토크나이저. */
export function tokenizeCsv(text: string): string[][] {
  // BOM 제거
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') {
        index += 1;
      }

      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

function normalizeHeaderCell(value: string) {
  return value.toLowerCase().replaceAll(/[\s_-]+/g, '');
}

function buildColumnMap(headerRow: string[]) {
  const columns = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeaderCell(cell);

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!columns.has(field) && aliases.includes(normalized)) {
        columns.set(field, index);
      }
    }
  });

  return columns;
}

function parseWorkType(value: string): WorkType {
  const trimmed = value.trim();

  if ((WORK_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as WorkType;
  }

  return TYPE_ALIASES[trimmed.replaceAll(/\s+/g, '')] ?? 'other';
}

function parseWorkStatus(value: string): WorkStatus {
  const trimmed = value.trim();

  if ((WORK_STATUSES as readonly string[]).includes(trimmed)) {
    return trimmed as WorkStatus;
  }

  return (
    STATUS_ALIASES[trimmed.toLowerCase().replaceAll(/\s+/g, '')] ?? 'planned'
  );
}

function parseRating(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  // 10점제로 보이면 5점제로 환산한다.
  const fiveScale = parsed > 5 ? parsed / 2 : parsed;

  return Math.min(5, Math.max(0.5, Math.round(fiveScale * 2) / 2));
}

function parseCsvDate(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseProgress(value: string): {
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: 'chapter' | 'episode' | 'volume' | null;
} {
  // 내보내기 형식: "current / total / unit / label" — 일부만 있어도 허용
  const parts = value.split('/').map((part) => part.trim());
  const numbers = parts
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part) && part > 0);
  const unit = parts.find((part): part is 'chapter' | 'episode' | 'volume' =>
    ['chapter', 'episode', 'volume'].includes(part),
  );

  return {
    progressCurrent: numbers[0] ?? null,
    progressTotal: numbers[1] ?? null,
    progressUnit: unit ?? null,
  };
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[;,]/)
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  );
}

export function parseRecordsCsv(text: string): ExternalImportEntry[] {
  const rows = tokenizeCsv(text);

  if (rows.length === 0) {
    return [];
  }

  const columns = buildColumnMap(rows[0]!);
  const titleIndex = columns.get('title');

  if (titleIndex === undefined) {
    throw new Error(appI18n.t('imports.csv.missingTitleColumn'));
  }

  const read = (cells: string[], field: string) => {
    const index = columns.get(field);

    return index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const entries: ExternalImportEntry[] = [];
  const seenKeys = new Set<string>();

  rows.slice(1).forEach((cells, rowIndex) => {
    const title = (cells[titleIndex] ?? '').trim();

    if (!title) {
      return;
    }

    const type = parseWorkType(read(cells, 'type'));
    const dedupeKey = `${type}:${title}`;

    if (seenKeys.has(dedupeKey)) {
      return;
    }

    seenKeys.add(dedupeKey);

    const progress = parseProgress(read(cells, 'progress'));
    const favoriteValue = read(cells, 'favorite').toLowerCase();

    entries.push({
      author: read(cells, 'author'),
      completedAt: parseCsvDate(read(cells, 'completedAt')),
      description: '',
      externalKey: `csv:${rowIndex}:${dedupeKey}`,
      favorite: ['1', 'o', 'true', 'y', 'yes', '예'].includes(favoriteValue),
      personalTags: parseTags(read(cells, 'personalTags')),
      ...progress,
      rating: parseRating(read(cells, 'rating')),
      review: read(cells, 'review'),
      shortReview: read(cells, 'shortReview'),
      sourceLabel: 'CSV',
      sourceUrl: '',
      startedAt: parseCsvDate(read(cells, 'startedAt')),
      status: parseWorkStatus(read(cells, 'status')),
      thumbnailUrl: read(cells, 'thumbnailUrl'),
      title,
      type,
    });
  });

  return entries;
}

/** 사용자가 빈 양식으로 시작할 수 있는 CSV 템플릿. */
export function createCsvImportTemplate() {
  return [
    appI18n.t('imports.csv.templateHeader'),
    appI18n.t('imports.csv.templateRowNovel'),
    appI18n.t('imports.csv.templateRowAnime'),
  ].join('\n');
}
