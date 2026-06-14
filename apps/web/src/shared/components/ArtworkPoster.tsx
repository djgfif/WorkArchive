import type { ReactNode } from 'react';
import { Box, Text } from '@mantine/core';

import {
  usePosterImageSource,
  type PosterImageVariant,
} from './usePosterImageSource';
import styles from './ArtworkPoster.module.css';
import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
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
            alt={t('shared.posterAlt', { title })}
            className={cx(
              cn(styles.posterImage),
              posterImage.loaded && cn(styles.posterImageLoaded),
            )}
            decoding={posterImage.decoding}
            loading={posterImage.loading}
            onError={posterImage.onError}
            onLoad={posterImage.onLoad}
            ref={posterImage.imageRef}
            src={posterImage.src}
          />
        </>
      ) : (
        <Box
          aria-label={t('shared.posterFallbackAlt', { title })}
          className={cn(styles.posterFallback)}
          data-cover-tone={getCoverTone(
            coverSeed ?? `${typeLabel ?? ''}:${title}`,
          )}
        >
          <Text className={cn(styles.posterFallbackType)}>
            {typeLabel ?? t('shared.posterFallbackType')}
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
