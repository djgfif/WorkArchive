import type { ReactNode } from 'react';

import { PageHero } from './PageHero';
import { WorkspacePageTemplate } from './PageTemplates';

interface FutureFeatureCard {
  description: string;
  title: string;
}

interface FutureFeaturePageProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  highlights: FutureFeatureCard[];
  template?: 'bare' | 'workspace';
  title: string;
}

export function FutureFeaturePage({
  actions,
  description,
  eyebrow,
  footer,
  highlights,
  template = 'workspace',
  title,
}: FutureFeaturePageProps) {
  const content = (
    <>
      <PageHero
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        title={title}
      />

      <section className="feature-placeholder-grid">
        {highlights.map((item) => (
          <article className="panel feature-placeholder-card stack" key={item.title}>
            <span className="mode-badge">준비 중</span>
            <h3 className="section-title">{item.title}</h3>
            <p className="muted-copy">{item.description}</p>
          </article>
        ))}
      </section>

      {footer && <section className="panel stack">{footer}</section>}
    </>
  );

  if (template === 'bare') {
    return <>{content}</>;
  }

  return <WorkspacePageTemplate>{content}</WorkspacePageTemplate>;
}
