import type { ReactNode } from 'react';
import { SimpleGrid, Stack, Text, Title } from '@mantine/core';

import {
  ActionRow,
  PageSection,
  PageShell,
  SectionCard,
  SectionIntro,
} from './AppPrimitives';
import { PageHero } from './PageHero';

interface PageFrameProps {
  children: ReactNode;
}

export function HomeHubPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1240}>{children}</PageShell>;
}

export function WorkspacePageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="lg" size={1280}>{children}</PageShell>;
}

export function DetailPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1200}>{children}</PageShell>;
}

export function FlowPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1280}>{children}</PageShell>;
}

interface AuthPageTemplateProps {
  description?: string;
  footer?: ReactNode;
  form: ReactNode;
  highlights?: Array<{
    description: string;
    title: string;
  }>;
  eyebrow?: string;
  title: string;
}

export function AuthPageTemplate({
  description,
  footer,
  form,
  highlights = [],
  eyebrow,
  title,
}: AuthPageTemplateProps) {
  return (
    <PageShell gap="md" size={480}>
      <SectionCard gap="lg" padding="xl" tone="default">
        <SectionIntro
          description={description}
          eyebrow={eyebrow}
          title={title}
          titleOrder={1}
        />
        {form}
        {footer && <Stack gap="xs">{footer}</Stack>}
      </SectionCard>

      {highlights.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {highlights.map((highlight) => (
            <PageSection
              divider={false}
              eyebrow="안내"
              key={highlight.title}
              title={highlight.title}
              titleOrder={3}
            >
              <Text c="var(--app-text-muted)">{highlight.description}</Text>
            </PageSection>
          ))}
        </SimpleGrid>
      )}

    </PageShell>
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
    <PageShell gap="lg" size={1120}>
      <PageHero
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        meta={meta}
        title={title}
        titleAs="h1"
      />
      {children}
    </PageShell>
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
    <PageShell gap="lg" size={760}>
      <SectionCard padding="xl" tone="default">
        <Text c="var(--app-accent)" fw={700} fz="0.76rem" lts="0.12em" tt="uppercase">
          {eyebrow}
        </Text>
        <Title order={1}>{title}</Title>
        <Text c="var(--app-text-secondary)" maw="58ch">
          {description}
        </Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </SectionCard>
    </PageShell>
  );
}
