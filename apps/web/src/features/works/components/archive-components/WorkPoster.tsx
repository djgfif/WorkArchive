import type { ReactNode } from 'react';

import { useAppTranslation } from '@app/i18n';
import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import type { PosterImageVariant } from '@shared/components/usePosterImageSource';
import { cn, css, cx } from './styles';

interface WorkPosterProps {
  className?: string;
  coverSeed?: string;
  overlay?: ReactNode;
  showFallbackTitle?: boolean;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: PosterImageVariant;
}

/**
 * works 전용 표지 — 공용 {@link ArtworkPoster} 위에 works i18n 키와
 * 더 좁은 행(row) 치수만 덮는 얇은 래퍼. 이미지 로딩·cover-tone·폴백
 * 로직과 스타일은 모두 shared 쪽 단일 구현을 재사용한다.
 */
export function WorkPoster({
  className,
  title,
  variant = 'card',
  ...rest
}: WorkPosterProps) {
  const { t } = useAppTranslation();

  return (
    <ArtworkPoster
      {...rest}
      className={cx(variant === 'row' && cn(css.posterRowCompact), className)}
      labels={{
        alt: t('works.list.posterAlt', { title }),
        fallbackAria: t('works.list.posterFallbackAria', { title }),
        fallbackType: t('works.list.posterFallbackType'),
      }}
      title={title}
      variant={variant}
    />
  );
}
