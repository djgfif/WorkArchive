import type { ReactNode } from 'react';
import { Box, Text } from '@mantine/core';

import {
  usePosterImageSource,
  type PosterImageVariant,
} from './usePosterImageSource';
import styles from './ArtworkPoster.module.css';
import { useAppTranslation } from '@app/i18n';
import { cn, cx } from '@shared/utils/class-names';

/**
 * 표지 접근성 문구. 미지정 시 `shared.*` 키를 쓰며, 다른 i18n 키를 쓰는
 * 호출부(예: works 의 WorkPoster)는 직접 해석한 문자열을 넘긴다.
 */
interface ArtworkPosterLabels {
  /** <img> 의 alt 텍스트. */
  alt: string;
  /** 폴백 표지 컨테이너의 aria-label. */
  fallbackAria: string;
  /** typeLabel·제목이 비었을 때 쓰는 기본 표시 문구. */
  fallbackType: string;
}

interface ArtworkPosterProps {
  className?: string;
  coverSeed?: string;
  labels?: ArtworkPosterLabels;
  overlay?: ReactNode;
  /**
   * 표지 없는 작품의 폴백에 제목을 표시할지 여부. 인접한 캡션/행 텍스트가
   * 이미 제목을 보여주는 그리드·목록 카드에서는 false 로 꺼서 중복을 없앤다.
   * 캡션이 없는 홈 선반·상세 표지에서는 기본값(true)으로 제목을 노출한다.
   */
  showFallbackTitle?: boolean;
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
  labels,
  overlay,
  showFallbackTitle = true,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: ArtworkPosterProps) {
  const { t } = useAppTranslation();
  const posterImage = usePosterImageSource(thumbnailUrl, variant);
  const altText = labels?.alt ?? t('shared.posterAlt', { title });
  const fallbackAriaText =
    labels?.fallbackAria ?? t('shared.posterFallbackAlt', { title });
  const fallbackTypeText = labels?.fallbackType ?? t('shared.posterFallbackType');

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
            alt={altText}
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
          aria-label={fallbackAriaText}
          className={cn(styles.posterFallback)}
          data-cover-tone={getCoverTone(
            coverSeed ?? `${typeLabel ?? ''}:${title}`,
          )}
        >
          <Text className={cn(styles.posterFallbackType)}>
            {typeLabel ?? fallbackTypeText}
          </Text>
          {showFallbackTitle && (
            <Text className={cn(styles.posterFallbackTitle)} title={title}>
              {title.trim() || fallbackTypeText}
            </Text>
          )}
        </Box>
      )}
      {overlay}
    </Box>
  );
}
