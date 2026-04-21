import type { ReactNode } from 'react';

import { PageHeader } from './AppPrimitives';

interface PageHeroProps {
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string | undefined;
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
  return (
    <PageHeader
      actions={actions}
      aside={aside}
      className={className}
      description={description}
      eyebrow={eyebrow}
      meta={meta}
      title={title}
      titleOrder={titleAs === 'h1' ? 1 : 2}
    />
  );
}
