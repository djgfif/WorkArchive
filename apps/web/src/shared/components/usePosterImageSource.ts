import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  cachePosterImageFromDisplaySource,
  getCachedPosterImageObjectUrl,
} from '@shared/services/poster-image-cache';
import { getDisplayImageUrlCandidates } from '@shared/utils/image-proxy';

export type PosterImageVariant = 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';

const FAILED_IMAGE_SOURCE_COOLDOWN_MS = 5 * 60 * 1000;
const failedImageSourceUntil = new Map<string, number>();

function getFailedImageSourceKey(cacheKey: string, sourceUrl: string) {
  return `${cacheKey}\n${sourceUrl}`;
}

function rememberFailedImageSource(cacheKey: string, sourceUrl: string) {
  if (!cacheKey || !sourceUrl) {
    return;
  }

  failedImageSourceUntil.set(
    getFailedImageSourceKey(cacheKey, sourceUrl),
    Date.now() + FAILED_IMAGE_SOURCE_COOLDOWN_MS,
  );
}

function hasRecentlyFailedImageSource(cacheKey: string, sourceUrl: string) {
  if (!cacheKey || !sourceUrl) {
    return false;
  }

  const failureUntil = failedImageSourceUntil.get(
    getFailedImageSourceKey(cacheKey, sourceUrl),
  );

  if (!failureUntil) {
    return false;
  }

  if (failureUntil <= Date.now()) {
    failedImageSourceUntil.delete(getFailedImageSourceKey(cacheKey, sourceUrl));

    return false;
  }

  return true;
}

function getUsableImageUrlCandidates(cacheKey: string, imageUrls: string[]) {
  return imageUrls.filter(
    (imageUrl) => !hasRecentlyFailedImageSource(cacheKey, imageUrl),
  );
}

export function clearPosterImageSourceFailuresForTest() {
  failedImageSourceUntil.clear();
}

export function usePosterImageSource(
  thumbnailUrl: string | null | undefined,
  variant: PosterImageVariant,
) {
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const imageUrls = useMemo(
    () => getDisplayImageUrlCandidates(thumbnailUrl),
    [thumbnailUrl],
  );
  const cacheKey = thumbnailUrl?.trim() || '';
  const [cachedImage, setCachedImage] = useState<{
    cacheKey: string;
    src: string;
  } | null>(null);
  const cachedImageSrc =
    cachedImage && cachedImage.cacheKey === cacheKey ? cachedImage.src : null;
  const usableImageUrls = useMemo(
    () => getUsableImageUrlCandidates(cacheKey, imageUrls),
    [cacheKey, imageUrls],
  );
  const imageUrlCandidates = useMemo(
    () =>
      cachedImageSrc ? [cachedImageSrc, ...usableImageUrls] : usableImageUrls,
    [cachedImageSrc, usableImageUrls],
  );
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = imageUrlCandidates[imageUrlIndex] ?? '';
  const loading: 'eager' | 'lazy' =
    variant === 'detail' || variant === 'form' || variant === 'hero'
      ? 'eager'
      : 'lazy';
  const markLoadedIfComplete = useCallback((imageElement: HTMLImageElement | null) => {
    if (!imageElement) {
      return;
    }

    if (imageElement.complete && imageElement.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);
  const imageRef = useCallback(
    (imageElement: HTMLImageElement | null) => {
      imageElementRef.current = imageElement;
      markLoadedIfComplete(imageElement);
    },
    [markLoadedIfComplete],
  );

  useEffect(() => {
    setImageUrlIndex(0);
    setFailed(false);
    setLoaded(false);
  }, [cachedImageSrc, thumbnailUrl]);

  useEffect(() => {
    setLoaded(false);
    markLoadedIfComplete(imageElementRef.current);
  }, [markLoadedIfComplete, src]);

  useEffect(() => {
    if (!cacheKey) {
      setCachedImage(null);

      return undefined;
    }

    let active = true;
    let objectUrl: string | null = null;

    void getCachedPosterImageObjectUrl(cacheKey).then((nextObjectUrl) => {
      if (!nextObjectUrl) {
        return;
      }

      objectUrl = nextObjectUrl;

      if (active) {
        setCachedImage({
          cacheKey,
          src: nextObjectUrl,
        });

        return;
      }

      URL.revokeObjectURL(nextObjectUrl);
    });

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [cacheKey]);

  return {
    decoding: 'async' as const,
    failed,
    imageRef,
    loaded,
    loading,
    onError: () => {
      rememberFailedImageSource(cacheKey, src);

      const nextIndex = imageUrlIndex + 1;

      if (nextIndex < imageUrlCandidates.length) {
        setImageUrlIndex(nextIndex);
        setLoaded(false);

        return;
      }

      setFailed(true);
    },
    onLoad: () => {
      setLoaded(true);

      if (src !== cachedImageSrc) {
        cachePosterImageFromDisplaySource(cacheKey, src);
      }
    },
    src,
  };
}
