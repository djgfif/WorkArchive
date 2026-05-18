import type { ReactNode } from 'react';
import { SimpleGrid, Stack, Text, Title } from '@mantine/core';

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

export function HomeLandingTemplate({ children }: PageFrameProps) {
  return <PageShell gap="var(--app-space-section)" size={1280}>{children}</PageShell>;
}

export function LibraryTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1320}>{children}</PageShell>;
}

export function WorkDetailTemplate({ children }: PageFrameProps) {
  return <PageShell gap="var(--app-space-section)" size={1180}>{children}</PageShell>;
}

export function FormFlowTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1160}>{children}</PageShell>;
}

export function AccountSettingsTemplate({ children }: PageFrameProps) {
  return <PageShell gap="lg" size={1120}>{children}</PageShell>;
}

export const HomeHubPageTemplate = HomeLandingTemplate;
export const WorkspacePageTemplate = LibraryTemplate;
export const DetailPageTemplate = WorkDetailTemplate;
export const FlowPageTemplate = FormFlowTemplate;

interface AuthPageTemplateProps {
  description?: string;
  footer?: ReactNode;
  form: ReactNode;
  highlights?: Array<{ description: string; title: string }>;
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
        <SectionIntro description={description} eyebrow={eyebrow} title={title} titleOrder={1} />
        {form}
        {footer && <Stack gap="xs">{footer}</Stack>}
      </SectionCard>

      {highlights.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {highlights.map((highlight) => (
            <SectionCard key={highlight.title} padding="lg" tone="subtle">
              <SectionIntro eyebrow="안내" title={highlight.title} titleOrder={3} />
              <Text c="dimmed">{highlight.description}</Text>
            </SectionCard>
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
    <AccountSettingsTemplate>
      <PageHero
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        meta={meta}
        title={title}
        titleAs="h1"
      />
      {children}
    </AccountSettingsTemplate>
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
      <SectionCard padding="xl" tone="hero">
        <Text c="archive.2" fw={800} size="xs" tt="uppercase">
          {eyebrow}
        </Text>
        <Title order={1}>{title}</Title>
        <Text c="dimmed" maw="58ch">{description}</Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </SectionCard>
    </PageShell>
  );
}
