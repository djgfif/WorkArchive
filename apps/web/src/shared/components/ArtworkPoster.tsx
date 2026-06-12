import type { ReactNode } from 'react';
import { Box, Text } from '@mantine/core';

import {
  usePosterImageSource,
  type PosterImageVariant,
} from './usePosterImageSource';
import styles from './ArtworkPoster.module.css';
import { cn, cx } from '@shared/utils/class-names';

interface ArtworkPosterProps {
  className?: string;
  coverSeed?: string;
  overlay?: ReactNode;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: PosterImageVariant;
}

const posterVariantClass: Record<
  NonNullable<ArtworkPosterProps['variant']>,
  string
> = {
  card: cn(styles.posterCard),
  detail: cn(styles.posterDetail),
  form: cn(styles.posterForm),
  grid: cn(styles.posterGrid),
  hero: cn(styles.posterHero),
  row: cn(styles.posterRow),
};

function getCoverTone(seed: string) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }

  return String(hash % 6);
}

export function ArtworkPoster({
  className,
  coverSeed,
  overlay,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: ArtworkPosterProps) {
  const posterImage = usePosterImageSource(thumbnailUrl, variant);

  return (
    <Box
      className={cx(
        cn(styles.posterShell),
        posterVariantClass[variant],
        className,
      )}
    >
      {posterImage.src && !posterImage.failed ? (
        <>
          {!posterImage.loaded && (
            <Box
              aria-hidden="true"
              className={cn(styles.posterImageSkeleton)}
            />
          )}
          <img
            alt={`${title} 포스터`}
            className={cx(
              cn(styles.posterImage),
              posterImage.loaded && cn(styles.posterImageLoaded),
            )}
            decoding={posterImage.decoding}
            loading={posterImage.loading}
            onError={posterImage.onError}
            onLoad={posterImage.onLoad}
            src={posterImage.src}
          />
        </>
      ) : (
        <Box
          aria-label={`${title} 포스터 대체 표지`}
          className={cn(styles.posterFallback)}
          data-cover-tone={getCoverTone(
            coverSeed ?? `${typeLabel ?? ''}:${title}`,
          )}
        >
          <Text className={cn(styles.posterFallbackType)}>
            {typeLabel ?? '기록'}
          </Text>
          <Text className={cn(styles.posterFallbackMark)}>
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          <span aria-hidden="true" />
        </Box>
      )}
      {overlay}
    </Box>
  );
}
