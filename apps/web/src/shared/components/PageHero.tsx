import type { ReactNode } from 'react';

interface PageHeroProps {
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  title: string;
  titleAs?: 'h1' | 'h2';
}

export function PageHero({
  actions,
  aside,
  className,
  description,
  eyebrow,
  meta,
  title,
  titleAs = 'h2',
}: PageHeroProps) {
  const TitleTag = titleAs;
  const heroClassName = ['panel', 'page-hero', className]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={heroClassName}>
      <div className="page-hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <TitleTag className="page-title">{title}</TitleTag>
        {description && <p className="body-copy">{description}</p>}
        {meta && <div className="page-hero-meta">{meta}</div>}
      </div>

      {(aside || actions) && (
        <div className="page-hero-side">
          {aside}
          {actions && <div className="button-row page-hero-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
