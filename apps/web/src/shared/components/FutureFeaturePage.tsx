import type { ReactNode } from 'react';

import { SimpleGrid, Text, Title } from '@mantine/core';

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

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {highlights.map((item) => (
          <SectionCard key={item.title} tone="subtle">
            <Text c="var(--app-accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
              준비 중
            </Text>
            <Title order={3}>
              {item.title}
            </Title>
            <Text c="var(--app-text-muted)">{item.description}</Text>
          </SectionCard>
        ))}
      </SimpleGrid>

      {footer && <SectionCard>{footer}</SectionCard>}
    </>
  );

  if (template === 'bare') {
    return <>{content}</>;
  }

  return <WorkspacePageTemplate>{content}</WorkspacePageTemplate>;
}
