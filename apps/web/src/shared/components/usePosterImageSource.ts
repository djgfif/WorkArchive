import { useEffect, useMemo, useState } from 'react';

import {
  cachePosterImageFromDisplaySource,
  getCachedPosterImageObjectUrl,
} from '@shared/services/poster-image-cache';
import { getDisplayImageUrlCandidates } from '@shared/utils/image-proxy';

export type PosterImageVariant = 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';

export function usePosterImageSource(
  thumbnailUrl: string | null | undefined,
  variant: PosterImageVariant,
) {
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
  const imageUrlCandidates = useMemo(
    () => (cachedImageSrc ? [cachedImageSrc, ...imageUrls] : imageUrls),
    [cachedImageSrc, imageUrls],
  );
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = imageUrlCandidates[imageUrlIndex] ?? '';
  const loading: 'eager' | 'lazy' =
    variant === 'detail' || variant === 'form' || variant === 'hero'
      ? 'eager'
      : 'lazy';

  useEffect(() => {
    setImageUrlIndex(0);
    setFailed(false);
    setLoaded(false);
  }, [cachedImageSrc, thumbnailUrl]);

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
    loaded,
    loading,
    onError: () => {
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
