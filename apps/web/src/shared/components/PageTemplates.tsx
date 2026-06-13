import type { ReactNode } from 'react';
import { Box, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import {
  ActionRow,
  PageShell,
  SectionCard,
} from './AppPrimitives';
import { PageHero } from './PageHero';
import { useAppTranslation } from '@app/i18n';
import styles from './PageTemplates.module.css';

const css = {
  authShell: styles.authShell ?? '',
  authViewport: styles.authViewport ?? '',
  brandCopy: styles.brandCopy ?? '',
  brandDescription: styles.brandDescription ?? '',
  brandHeader: styles.brandHeader ?? '',
  brandKicker: styles.brandKicker ?? '',
  brandLink: styles.brandLink ?? '',
  brandMark: styles.brandMark ?? '',
  brandName: styles.brandName ?? '',
  brandPanel: styles.brandPanel ?? '',
  brandTitle: styles.brandTitle ?? '',
  eyebrow: styles.eyebrow ?? '',
  featureDescription: styles.featureDescription ?? '',
  featureIcon: styles.featureIcon ?? '',
  featureList: styles.featureList ?? '',
  featureTitle: styles.featureTitle ?? '',
  footer: styles.footer ?? '',
  formDescription: styles.formDescription ?? '',
  formPanel: styles.formPanel ?? '',
  formTitle: styles.formTitle ?? '',
  trustCard: styles.trustCard ?? '',
  trustDot: styles.trustDot ?? '',
  trustItem: styles.trustItem ?? '',
};

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

type AuthHighlight = {
  description: string;
  icon?: ReactNode;
  title: string;
};

function DefaultHighlightIcon() {
  return (
    <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

interface AuthPageTemplateProps {
  description?: string;
  footer?: ReactNode;
  form: ReactNode;
  highlights?: AuthHighlight[];
  eyebrow?: string;
  title: ReactNode;
}

export function AuthPageTemplate({
  description,
  footer,
  form,
  eyebrow,
  highlights,
  title,
}: AuthPageTemplateProps) {
  const { t } = useAppTranslation();
  const defaultBrandFeatures: AuthHighlight[] = [
    {
      icon: (
        <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      title: 'Local-first',
      description: t('shared.authTemplate.localFirstDescription'),
    },
    {
      icon: (
        <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      ),
      title: t('shared.authTemplate.backupTitle'),
      description: t('shared.authTemplate.backupDescription'),
    },
    {
      icon: (
        <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
          <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      title: t('shared.authTemplate.noPublicTitle'),
      description: t('shared.authTemplate.noPublicDescription'),
    },
  ];
  const trustNotes = [
    t('shared.authTemplate.trustLocal'),
    t('shared.authTemplate.trustPrivate'),
    t('shared.authTemplate.trustApiKeys'),
  ];
  const brandFeatures = highlights?.length ? highlights : defaultBrandFeatures;

  return (
    <Box className={css.authViewport}>
      <Box className={css.authShell}>
        {/* ── 좌측: 브랜드 패널 ── */}
        <Box className={css.brandPanel}>
          {/* 브랜드 로고 */}
          <Link className={css.brandLink} to="/">
            <Group className={css.brandHeader} gap="sm" wrap="nowrap">
              <Box className={css.brandMark}>
                WA
              </Box>
              <Stack gap={0}>
                <Text className={css.brandName} fw={800} size="sm">
                  Work Archive
                </Text>
                <Text className={css.brandKicker} size="xs">
                  {t('shared.authTemplate.brandKicker')}
                </Text>
              </Stack>
            </Group>
          </Link>

          {/* 슬로건 */}
          <Stack className={css.brandCopy} gap="sm">
            <Title className={css.brandTitle} order={2}>
              {t('shared.authTemplate.titleLine1')}
              <br />
              {t('shared.authTemplate.titleLine2')}
            </Title>
            <Text className={css.brandDescription} size="sm">
              {t('shared.authTemplate.description')}
            </Text>
          </Stack>

          {/* 특징 목록 */}
          <Stack className={css.featureList} gap="md">
            {brandFeatures.map((feature) => (
              <Group key={feature.title} gap="sm" wrap="nowrap" align="flex-start">
                <Box className={css.featureIcon}>
                  {feature.icon ?? <DefaultHighlightIcon />}
                </Box>
                <Stack gap={1}>
                  <Text className={css.featureTitle} fw={700} size="sm">
                    {feature.title}
                  </Text>
                  <Text className={css.featureDescription} size="xs">
                    {feature.description}
                  </Text>
                </Stack>
              </Group>
            ))}
          </Stack>
        </Box>

        {/* ── 우측: 폼 패널 ── */}
        <Box className={css.formPanel}>
          {/* 폼 헤더 */}
          <Stack gap={6}>
            {eyebrow && (
              <Text
                className={css.eyebrow}
                size="xs"
              >
                {eyebrow}
              </Text>
            )}
            <Title className={css.formTitle} order={1}>
              {title}
            </Title>
            {description && (
              <Text className={css.formDescription} size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </Stack>

          <Divider color="var(--app-border-subtle)" />

          {/* 폼 */}
          {form}

          <Stack className={css.trustCard} gap="xs">
            {trustNotes.map((note) => (
              <Box className={css.trustItem} key={note}>
                <span className={css.trustDot} />
                <span>{note}</span>
              </Box>
            ))}
          </Stack>

          {/* 푸터 링크 */}
          {footer && (
            <Box className={css.footer}>
              {footer}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
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
