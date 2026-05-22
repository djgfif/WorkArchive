import { useEffect, useState, type ReactNode } from 'react';
import { Box, Text } from '@mantine/core';

import styles from './ArtworkPoster.module.css';

interface ArtworkPosterProps {
  className?: string;
  coverSeed?: string;
  overlay?: ReactNode;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';
}

const posterVariantClass: Record<NonNullable<ArtworkPosterProps['variant']>, string> = {
  card: cn(styles.posterCard),
  detail: cn(styles.posterDetail),
  form: cn(styles.posterForm),
  grid: cn(styles.posterGrid),
  hero: cn(styles.posterHero),
  row: cn(styles.posterRow),
};

function cn(value: string | undefined) {
  return value ?? '';
}

function getCoverTone(seed: string) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }

  return String(hash % 6);
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
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
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [thumbnailUrl]);

  return (
    <Box className={cx(cn(styles.posterShell), posterVariantClass[variant], className)}>
      {thumbnailUrl && !imageFailed ? (
        <>
          {!imageLoaded && (
            <Box aria-hidden="true" className={cn(styles.posterImageSkeleton)} />
          )}
          <img
            alt={`${title} 포스터`}
            className={cx(
              cn(styles.posterImage),
              imageLoaded && cn(styles.posterImageLoaded),
            )}
            onError={() => setImageFailed(true)}
            onLoad={() => setImageLoaded(true)}
            src={thumbnailUrl}
          />
        </>
      ) : (
        <Box
          aria-label={`${title} 포스터 대체 표지`}
          className={cn(styles.posterFallback)}
          data-cover-tone={getCoverTone(coverSeed ?? `${typeLabel ?? ''}:${title}`)}
        >
          <Text className={cn(styles.posterFallbackType)}>{typeLabel ?? '기록'}</Text>
          <Text className={cn(styles.posterFallbackMark)}>
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          <Text className={cn(styles.posterFallbackType)}>표지 없음</Text>
        </Box>
      )}
      {overlay}
    </Box>
  );
}
