import type { ReactNode } from 'react';
import { SimpleGrid, Text, Title } from '@mantine/core';

import {
  ActionRow,
  PageShell,
  SectionCard,
  SectionIntro,
} from './AppPrimitives';
import { PageHero } from './PageHero';

interface PageFrameProps {
  children: ReactNode;
}

export function HomeHubPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1180}>{children}</PageShell>;
}

export function WorkspacePageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="lg" size={1260}>{children}</PageShell>;
}

export function DetailPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1120}>{children}</PageShell>;
}

export function FlowPageTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1080}>{children}</PageShell>;
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
    <PageShell gap="lg" size={720}>
      <SectionCard gap="lg" tone="hero">
        <SectionIntro
          description={description}
          eyebrow={eyebrow}
          title={title}
          titleOrder={1}
        />
        {form}
      </SectionCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {highlights.map((highlight) => (
          <SectionCard key={highlight.title} gap="sm" padding="lg" tone="subtle">
            <Text c="var(--app-accent)" fw={700} fz="0.76rem" lts="0.12em" tt="uppercase">
              안내
            </Text>
            <Title order={3}>{highlight.title}</Title>
            <Text c="var(--app-text-muted)">{highlight.description}</Text>
          </SectionCard>
        ))}
      </SimpleGrid>

      {footer && <SectionCard padding="lg" tone="subtle">{footer}</SectionCard>}
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
      <SectionCard tone="hero">
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
