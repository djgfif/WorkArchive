import { cn } from '@shared/utils/class-names';
import styles from './PosterHoverOverlay.module.css';

/** 부모 카드에 부여하면 hover/focus 시 오버레이가 노출되는 전역 클래스. */
export const POSTER_CARD_HOVER_CLASS = 'poster-card-hover';

interface PosterHoverOverlayProps {
  rating?: number | null;
  statusLabel: string;
  title: string;
}

/**
 * 포스터 카드 호버 오버레이 — 하단 그라디언트 + 제목·상태·별점.
 * 그리드(WorkCards)와 홈 선반(HomePage)이 공유하는 단일 구현.
 * 노출 트리거는 부모 카드의 {@link POSTER_CARD_HOVER_CLASS} hover/focus 다.
 */
export function PosterHoverOverlay({
  rating,
  statusLabel,
  title,
}: PosterHoverOverlayProps) {
  return (
    <div aria-hidden="true" className={cn(styles.overlay)}>
      <p className={cn(styles.title)}>{title}</p>
      <div className={cn(styles.meta)}>
        <span className={cn(styles.status)}>{statusLabel}</span>
        {rating !== null && rating !== undefined && (
          <span className={cn(styles.rating)}>★ {rating.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
}
