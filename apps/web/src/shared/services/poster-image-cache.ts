import Dexie, { type Table } from 'dexie';

const DB_NAME = 'work-archive-poster-image-cache';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 500;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface CachedPosterImageRecord {
  id: string;
  blob: Blob;
  contentType: string;
  createdAt: string;
  lastAccessedAt: string;
  sizeBytes: number;
  sourceUrl: string;
  updatedAt: string;
}

class PosterImageCacheDatabase extends Dexie {
  posterImages!: Table<CachedPosterImageRecord, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      posterImages: 'id, updatedAt, lastAccessedAt, sizeBytes',
    });
  }
}

const posterImageCacheDb = new PosterImageCacheDatabase();
const pendingCacheWrites = new Map<string, Promise<void>>();

function normalizeCacheKey(thumbnailUrl: string | null | undefined) {
  return thumbnailUrl?.trim() || '';
}

function isObjectUrlSupported() {
  return (
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof URL.revokeObjectURL === 'function'
  );
}

function isSameOriginImageProxyUrl(displaySourceUrl: string) {
  try {
    const url = new URL(displaySourceUrl, window.location.origin);

    return (
      url.origin === window.location.origin &&
      url.pathname.endsWith('/api/image-proxy')
    );
  } catch {
    return false;
  }
}

function readAllowedContentType(response: Response) {
  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  return contentType && ALLOWED_CONTENT_TYPES.has(contentType)
    ? contentType
    : null;
}

async function trimPosterImageCache() {
  const overflowCount = (await posterImageCacheDb.posterImages.count()) - MAX_CACHE_ENTRIES;

  if (overflowCount <= 0) {
    return;
  }

  const recordsToDelete = await posterImageCacheDb.posterImages
    .orderBy('lastAccessedAt')
    .limit(overflowCount)
    .primaryKeys();

  if (recordsToDelete.length > 0) {
    await posterImageCacheDb.posterImages.bulkDelete(recordsToDelete as string[]);
  }
}

async function writePosterImageCache(
  cacheKey: string,
  sourceUrl: string,
  response: Response,
) {
  const contentType = readAllowedContentType(response);

  if (!contentType) {
    return;
  }

  const blob = await response.blob();

  if (blob.size <= 0 || blob.size > MAX_IMAGE_BYTES) {
    return;
  }

  const now = new Date().toISOString();
  const existing = await posterImageCacheDb.posterImages.get(cacheKey);

  await posterImageCacheDb.posterImages.put({
    id: cacheKey,
    blob,
    contentType,
    createdAt: existing?.createdAt ?? now,
    lastAccessedAt: now,
    sizeBytes: blob.size,
    sourceUrl,
    updatedAt: now,
  });
  await trimPosterImageCache();
}

export async function getCachedPosterImageObjectUrl(
  thumbnailUrl: string | null | undefined,
) {
  const cacheKey = normalizeCacheKey(thumbnailUrl);

  if (!cacheKey || !isObjectUrlSupported()) {
    return null;
  }

  const cached = await posterImageCacheDb.posterImages.get(cacheKey);

  if (!cached) {
    return null;
  }

  await posterImageCacheDb.posterImages.update(cacheKey, {
    lastAccessedAt: new Date().toISOString(),
  });

  return URL.createObjectURL(cached.blob);
}

export function cachePosterImageFromDisplaySource(
  thumbnailUrl: string | null | undefined,
  displaySourceUrl: string,
) {
  const cacheKey = normalizeCacheKey(thumbnailUrl);

  if (!cacheKey || !isSameOriginImageProxyUrl(displaySourceUrl)) {
    return;
  }

  if (pendingCacheWrites.has(cacheKey)) {
    return;
  }

  const writePromise = fetch(displaySourceUrl, {
    cache: 'force-cache',
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) {
        return;
      }

      await writePosterImageCache(cacheKey, displaySourceUrl, response);
    })
    .catch(() => undefined)
    .finally(() => {
      pendingCacheWrites.delete(cacheKey);
    });

  pendingCacheWrites.set(cacheKey, writePromise);
}

export async function clearPosterImageCache() {
  pendingCacheWrites.clear();
  await posterImageCacheDb.posterImages.clear();
}

export async function deletePosterImageCacheDatabase() {
  pendingCacheWrites.clear();
  posterImageCacheDb.close();
  await posterImageCacheDb.delete();
}
