import { Box, Text } from '@mantine/core';
import type { ReactNode } from 'react';

import { useAppTranslation } from '@app/i18n';
import { usePosterImageSource } from '@shared/components/usePosterImageSource';
import { cn, css, cx } from './styles';

type PosterVariant = 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';

const posterVariantClass: Record<PosterVariant, string> = {
  card: cn(css.posterCard),
  detail: cn(css.posterDetail),
  form: cn(css.posterForm),
  grid: cn(css.posterGrid),
  hero: cn(css.posterHero),
  row: cn(css.posterRow),
};

interface WorkPosterProps {
  className?: string;
  coverSeed?: string;
  overlay?: ReactNode;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: PosterVariant;
}

function getCoverTone(seed: string) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }

  return String(hash % 6);
}

export function WorkPoster({
  className,
  coverSeed,
  overlay,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: WorkPosterProps) {
  const { t } = useAppTranslation();
  const posterImage = usePosterImageSource(thumbnailUrl, variant);

  return (
    <Box
      className={cx(
        cn(css.posterShell),
        posterVariantClass[variant],
        className,
      )}
    >
      {posterImage.src && !posterImage.failed ? (
        <>
          {!posterImage.loaded && (
            <Box aria-hidden="true" className={cn(css.posterImageSkeleton)} />
          )}
          <img
            alt={t('works.list.posterAlt', { title })}
            className={cx(
              cn(css.posterImage),
              posterImage.loaded && cn(css.posterImageLoaded),
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
          aria-label={t('works.list.posterFallbackAria', { title })}
          className={cn(css.posterFallback)}
          data-cover-tone={getCoverTone(
            coverSeed ?? `${typeLabel ?? ''}:${title}`,
          )}
        >
          <Text className={cn(css.posterFallbackType)}>
            {typeLabel ?? t('works.list.posterFallbackType')}
          </Text>
          <Text className={cn(css.posterFallbackMark)}>
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          <span aria-hidden="true" />
        </Box>
      )}
      {overlay}
    </Box>
  );
}
