import { getApiBaseUrl } from '@shared/services/api-client';

const PROXIED_IMAGE_HOST_SUFFIXES = [
  'anilist.co',
  'books.google.com',
  'covers.openlibrary.org',
  'daumcdn.net',
  'googleusercontent.com',
  'image.aladin.co.kr',
  'image.tmdb.org',
  'kakaocdn.net',
  'pstatic.net',
  'static.tvmaze.com',
  'wikimedia.org',
] as const;

function isProxiedImageHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  return PROXIED_IMAGE_HOST_SUFFIXES.some(
    (suffix) =>
      normalizedHostname === suffix ||
      normalizedHostname.endsWith(`.${suffix}`),
  );
}

export function getDisplayImageUrl(thumbnailUrl?: string | null) {
  return getDisplayImageUrlCandidates(thumbnailUrl)[0] ?? '';
}

export function getDisplayImageUrlCandidates(thumbnailUrl?: string | null) {
  const normalized = thumbnailUrl?.trim();

  if (!normalized) {
    return [];
  }

  if (
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('/')
  ) {
    return [normalized];
  }

  try {
    const url = new URL(normalized);

    if (isProxiedImageHost(url.hostname)) {
      const proxiedUrl = `${getApiBaseUrl()}/image-proxy?url=${encodeURIComponent(
        normalized,
      )}`;

      return url.protocol === 'https:'
        ? [proxiedUrl, normalized]
        : [proxiedUrl];
    }
  } catch {
    return [normalized];
  }

  return [normalized];
}
