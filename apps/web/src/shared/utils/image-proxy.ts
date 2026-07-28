import { getApiBaseUrl } from '@shared/services/api-client';

const PROXIED_IMAGE_HOST_SUFFIXES = [
  'archive.org',
  'books.google.com',
  'covers.openlibrary.org',
  'daumcdn.net',
  'googleusercontent.com',
  'image.aladin.co.kr',
  'image.tmdb.org',
  'kakaocdn.net',
  'pstatic.net',
  's4.anilist.co',
  'static.tvmaze.com',
  'wikimedia.org',
] as const;

const SAFE_INLINE_IMAGE_PATTERN =
  /^data:image\/(?:avif|gif|jpeg|png|webp)(?:;[^,]*)?,/i;

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

  if (normalized.startsWith('//')) {
    return getDisplayImageUrlCandidates(`https:${normalized}`);
  }

  if (
    normalized.startsWith('blob:') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    SAFE_INLINE_IMAGE_PATTERN.test(normalized)
  ) {
    return [normalized];
  }

  try {
    const url = new URL(normalized);

    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      isProxiedImageHost(url.hostname)
    ) {
      url.protocol = 'https:';
      url.username = '';
      url.password = '';
      url.hash = '';

      const proxiedSourceUrl = url.toString();
      const proxiedUrl = `${getApiBaseUrl()}/image-proxy?url=${encodeURIComponent(
        proxiedSourceUrl,
      )}`;

      return [proxiedUrl];
    }
  } catch {
    return [];
  }

  return [];
}
