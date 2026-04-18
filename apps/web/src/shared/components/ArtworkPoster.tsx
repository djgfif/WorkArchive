import { useEffect, useState } from 'react';

interface ArtworkPosterProps {
  className?: string;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: 'card' | 'detail' | 'form';
}

export function ArtworkPoster({
  className,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: ArtworkPosterProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailUrl]);

  const posterClassName = [
    'artwork-poster',
    `artwork-poster--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (thumbnailUrl && !imageFailed) {
    return (
      <img
        alt={`${title} 표지 이미지`}
        className={posterClassName}
        onError={() => setImageFailed(true)}
        src={thumbnailUrl}
      />
    );
  }

  return (
    <div aria-hidden="true" className={`${posterClassName} artwork-poster--fallback`}>
      <span className="artwork-poster-initial">
        {(title.trim()[0] ?? 'W').toUpperCase()}
      </span>
      {typeLabel && <span className="artwork-poster-caption">{typeLabel}</span>}
    </div>
  );
}
