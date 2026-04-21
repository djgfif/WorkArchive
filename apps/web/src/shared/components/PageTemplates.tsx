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
  return <PageShell size={1240}>{children}</PageShell>;
}

export function WorkspacePageTemplate({ children }: PageFrameProps) {
  return <PageShell size={1240}>{children}</PageShell>;
}

export function DetailPageTemplate({ children }: PageFrameProps) {
  return <PageShell size={1240}>{children}</PageShell>;
}

export function FlowPageTemplate({ children }: PageFrameProps) {
  return <PageShell size={1120}>{children}</PageShell>;
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
    <>
      <SectionCard tone="hero">
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
          <SectionCard key={highlight.title} tone="subtle">
            <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
              안내
            </Text>
            <Title c="var(--text-primary)" order={2}>
              {highlight.title}
            </Title>
            <Text c="var(--text-muted)">{highlight.description}</Text>
          </SectionCard>
        ))}
      </SimpleGrid>

      {footer && <SectionCard tone="subtle">{footer}</SectionCard>}
    </>
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
    <PageShell size={1240}>
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
    <PageShell size={760}>
      <SectionCard tone="hero">
        <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
          {eyebrow}
        </Text>
        <Title c="var(--text-primary)" order={1}>
          {title}
        </Title>
        <Text c="var(--text-secondary)" maw="58ch">
          {description}
        </Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </SectionCard>
    </PageShell>
  );
}
