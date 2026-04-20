import type { ReactNode } from 'react';

import { PageHero } from './PageHero';

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

interface PageFrameProps {
  children: ReactNode;
  className?: string;
}

export function HomeHubPageTemplate({ children, className }: PageFrameProps) {
  return (
    <section className={joinClassNames('page-template page-template--home stack', className)}>
      {children}
    </section>
  );
}

export function WorkspacePageTemplate({ children, className }: PageFrameProps) {
  return (
    <section
      className={joinClassNames('page-template page-template--workspace stack', className)}
    >
      {children}
    </section>
  );
}

export function DetailPageTemplate({ children, className }: PageFrameProps) {
  return (
    <section className={joinClassNames('page-template page-template--detail stack', className)}>
      {children}
    </section>
  );
}

export function FlowPageTemplate({ children, className }: PageFrameProps) {
  return (
    <section className={joinClassNames('page-template page-template--flow stack', className)}>
      {children}
    </section>
  );
}

interface AuthPageTemplateProps {
  description: string;
  footer?: ReactNode;
  form: ReactNode;
  highlights: Array<{
    description: string;
    title: string;
  }>;
  eyebrow: string;
  title: string;
}

export function AuthPageTemplate({
  description,
  footer,
  form,
  highlights,
  eyebrow,
  title,
}: AuthPageTemplateProps) {
  return (
    <section className="auth-page-template">
      <article className="panel auth-page-template-card stack">
        <div className="section-heading">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="section-description">{description}</p>
        </div>

        {form}
      </article>

      <section className="auth-page-template-grid">
        {highlights.map((highlight) => (
          <article
            className="panel auth-page-template-feature stack"
            key={highlight.title}
          >
            <span className="mode-badge">안내</span>
            <h2 className="section-title">{highlight.title}</h2>
            <p className="muted-copy">{highlight.description}</p>
          </article>
        ))}
      </section>

      {footer && <section className="panel stack auth-page-template-footer">{footer}</section>}
    </section>
  );
}

interface AccountPageTemplateProps {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  meta?: ReactNode;
  title: string;
}

export function AccountPageTemplate({
  actions,
  children,
  description,
  eyebrow,
  meta,
  title,
}: AccountPageTemplateProps) {
  return (
    <section className="page-template page-template--account stack">
      <PageHero
        actions={actions}
        className="account-page-hero"
        description={description}
        eyebrow={eyebrow}
        meta={meta}
        title={title}
        titleAs="h1"
      />
      {children}
    </section>
  );
}

interface MinimalPageTemplateProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}

export function MinimalPageTemplate({
  actions,
  description,
  eyebrow,
  title,
}: MinimalPageTemplateProps) {
  return (
    <section className="panel page-template page-template--minimal stack">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="body-copy">{description}</p>
      {actions && <div className="button-row">{actions}</div>}
    </section>
  );
}
