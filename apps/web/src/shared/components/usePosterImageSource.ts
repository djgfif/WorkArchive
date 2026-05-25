import { useEffect, useMemo, useState } from 'react';

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
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = imageUrls[imageUrlIndex] ?? '';
  const loading: 'eager' | 'lazy' =
    variant === 'detail' || variant === 'form' || variant === 'hero'
      ? 'eager'
      : 'lazy';

  useEffect(() => {
    setImageUrlIndex(0);
    setFailed(false);
    setLoaded(false);
  }, [thumbnailUrl]);

  return {
    decoding: 'async' as const,
    failed,
    loaded,
    loading,
    onError: () => {
      const nextIndex = imageUrlIndex + 1;

      if (nextIndex < imageUrls.length) {
        setImageUrlIndex(nextIndex);
        setLoaded(false);

        return;
      }

      setFailed(true);
    },
    onLoad: () => setLoaded(true),
    src,
  };
}
