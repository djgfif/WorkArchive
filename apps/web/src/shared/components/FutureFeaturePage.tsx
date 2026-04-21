import type { ReactNode } from 'react';

import { Text, Title } from '@mantine/core';

import { SectionCard } from './AppPrimitives';
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
          <SectionCard key={item.title} tone="subtle">
            <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
              준비 중
            </Text>
            <Title c="var(--text-primary)" order={3}>
              {item.title}
            </Title>
            <Text c="var(--text-muted)">{item.description}</Text>
          </SectionCard>
        ))}
      </section>

      {footer && <SectionCard>{footer}</SectionCard>}
    </>
  );

  if (template === 'bare') {
    return <>{content}</>;
  }

  return <WorkspacePageTemplate>{content}</WorkspacePageTemplate>;
}
