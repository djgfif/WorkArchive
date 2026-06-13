import React from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { Link, NavLink } from 'react-router-dom';

import styles from './AppPrimitives.module.css';
import { cn, cx } from '@shared/utils/class-names';
import { appI18n, useAppTranslation } from '@app/i18n';

const css = styles;

type SurfaceTone = 'default' | 'hero' | 'subtle';
type MessageTone = 'error' | 'info' | 'loading' | 'success';
type AppActionTone = 'danger' | 'ghost' | 'primary' | 'quiet' | 'secondary';
type AppBadgeTone =
  | 'accent'
  | 'danger'
  | 'default'
  | 'error'
  | 'info'
  | 'muted'
  | 'success'
  | 'warning';

interface PageShellProps {
  children: ReactNode;
  gap?: string | number;
  size?: number;
}

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  gap?: string | number;
  padding?: string | number;
  tone?: SurfaceTone;
}

interface SurfaceLinkCardProps extends SectionCardProps {
  to: string;
}

interface ActionRowProps {
  children: ReactNode;
  className?: string;
  justify?: 'center' | 'flex-end' | 'flex-start' | 'space-between';
}

interface SectionIntroProps {
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6;
}

interface PageSectionProps {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  divider?: boolean;
  eyebrow?: ReactNode;
  title?: ReactNode;
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6;
}

interface AppBadgeProps {
  children: ReactNode;
  tone?: AppBadgeTone;
}

interface MetricPillProps {
  label: ReactNode;
  value: ReactNode;
}

interface StatCardProps {
  accent?: boolean;
  description?: ReactNode;
  label: ReactNode;
  to?: string;
  value: ReactNode;
}

interface FeedbackMessageProps {
  children: ReactNode;
  title?: ReactNode;
  tone?: MessageTone;
}

interface ChipSummaryProps {
  emptyLabel?: ReactNode;
  label: ReactNode;
  values: ReactNode[];
}

interface StateMessageProps {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  tone?: MessageTone;
}

interface LoadingStateProps {
  actionWidth?: number;
  rows?: number;
  title?: ReactNode;
}

interface LoadingRowsProps {
  rows?: number;
}

interface PageHeaderProps {
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6;
}

interface ActionBarProps {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}

interface KeyValueGridProps {
  columns?: 1 | 2 | 3;
  items: Array<{ label: ReactNode; value: ReactNode }>;
}

interface AppButtonProps {
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  leftSection?: ReactNode;
  loading?: boolean;
  onClick?: ComponentPropsWithoutRef<'button'>['onClick'];
  rightSection?: ReactNode;
  size?:
    | 'compact-md'
    | 'compact-sm'
    | 'compact-xs'
    | 'lg'
    | 'md'
    | 'sm'
    | 'xl'
    | 'xs';
  style?: React.CSSProperties;
  tone?: AppActionTone;
  type?: ComponentPropsWithoutRef<'button'>['type'];
}

interface AppLinkButtonProps extends Omit<AppButtonProps, 'onClick' | 'type'> {
  onClick?: ComponentPropsWithoutRef<'a'>['onClick'];
  state?: ComponentPropsWithoutRef<typeof Link>['state'];
  to: ComponentPropsWithoutRef<typeof Link>['to'];
}

interface BrandLinkProps {
  heading: string;
  kicker: string;
  to?: ComponentPropsWithoutRef<typeof Link>['to'];
}

interface ThemeToggleControlProps {
  fullWidth?: boolean;
}

interface AppNavLinkProps {
  badge?: ReactNode;
  children: ReactNode;
  end?: boolean;
  fullWidth?: boolean;
  onClick?: ComponentPropsWithoutRef<'a'>['onClick'];
  state?: ComponentPropsWithoutRef<typeof NavLink>['state'];
  to: ComponentPropsWithoutRef<typeof NavLink>['to'];
}

function getSurfaceBackground(tone: SurfaceTone) {
  // 가이드 5.1: 그라데이션 카드 장식 대신 surface 명도 차로 강조 영역을 표현한다.
  if (tone === 'hero') {
    return 'var(--app-surface-hero)';
  }

  return tone === 'subtle'
    ? 'var(--app-surface-subtle)'
    : 'var(--app-surface-card)';
}

function getActionToneProps(tone: AppActionTone) {
  switch (tone) {
    case 'primary':
      // 가이드 6/5.1: 절제된 단색 accent. 그라데이션 CTA 제거.
      return {
        color: 'archive',
        variant: 'filled',
      } as const;
    case 'quiet':
      return { color: 'gray', variant: 'subtle' } as const;
    case 'ghost':
      return { color: 'gray', variant: 'transparent' } as const;
    case 'danger':
      return { color: 'red', variant: 'light' } as const;
    case 'secondary':
    default:
      return { variant: 'default' } as const;
  }
}

function getBadgeToneProps(tone: AppBadgeTone) {
  switch (tone) {
    case 'accent':
      return { color: 'archive' } as const;
    case 'danger':
    case 'error':
      return { color: 'red' } as const;
    case 'info':
      return { color: 'blue' } as const;
    case 'warning':
      return { color: 'yellow' } as const;
    case 'success':
      return { color: 'teal' } as const;
    case 'muted':
      return { color: 'gray', variant: 'outline' } as const;
    case 'default':
    default:
      return { color: 'gray' } as const;
  }
}

function getMessageLabel(tone: MessageTone) {
  switch (tone) {
    case 'success':
      return appI18n.t('common.completed');
    case 'loading':
      return appI18n.t('common.loading');
    case 'error':
      return appI18n.t('common.error');
    case 'info':
    default:
      return appI18n.t('common.guide');
  }
}

function getMessageColor(tone: MessageTone) {
  switch (tone) {
    case 'success':
      return 'teal';
    case 'loading':
      return 'archive';
    case 'info':
      return 'gray';
    case 'error':
    default:
      return 'red';
  }
}

function getResponsiveColumns(columns: 1 | 2 | 3) {
  if (columns === 1) return { base: 1 };
  if (columns === 3) return { base: 1, sm: 2, lg: 3 };
  return { base: 1, sm: 2 };
}

export function PageShell({
  children,
  gap = 'xl',
  size = 1240,
}: PageShellProps) {
  return (
    <Container px="md" size={size} w="100%">
      <Stack gap={gap}>{children}</Stack>
    </Container>
  );
}

export function SectionCard({
  children,
  className,
  gap = 'md',
  padding = 'lg',
  tone = 'default',
}: SectionCardProps) {
  return (
    <Paper
      className={cx(
        css.sectionCard,
        tone === 'hero' && css.sectionCardHero,
        tone === 'subtle' && css.sectionCardSubtle,
        className,
      )}
      p={padding}
      radius={tone === 'hero' ? 'xl' : 'lg'}
      styles={{
        root: {
          background: getSurfaceBackground(tone),
          borderColor:
            tone === 'hero'
              ? 'var(--app-border-strong)'
              : 'var(--app-border-subtle)',
          boxShadow: tone === 'hero' ? 'var(--app-shadow-card)' : 'none',
          overflow: 'hidden',
        },
      }}
      withBorder
    >
      <Stack gap={gap}>{children}</Stack>
    </Paper>
  );
}

export const AppCard = SectionCard;
export const AppPage = PageShell;
export const AppText = Text;

export function SurfaceLinkCard({
  children,
  className,
  gap = 'md',
  padding = 'lg',
  to,
  tone = 'default',
}: SurfaceLinkCardProps) {
  return (
    <Paper
      className={cx(
        css.sectionCard,
        css.surfaceLink,
        tone === 'hero' && css.sectionCardHero,
        tone === 'subtle' && css.sectionCardSubtle,
        className,
      )}
      component={Link}
      p={padding}
      radius="lg"
      styles={{
        root: {
          background: getSurfaceBackground(tone),
          borderColor: 'var(--app-border-subtle)',
          color: 'inherit',
          display: 'block',
          textDecoration: 'none',
          transition: [
            'transform var(--wa-motion-normal, 240ms)',
            'border-color var(--wa-motion-fast, 150ms)',
            'background var(--wa-motion-fast, 150ms)',
          ].join(', '),
          '&:hover': {
            transform: 'translateY(-1px)',
            borderColor: 'var(--app-border-default)',
            background:
              tone === 'subtle'
                ? 'var(--app-surface-subtle)'
                : 'var(--app-surface-card)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
      }}
      to={to}
      withBorder
    >
      <Stack gap={gap}>{children}</Stack>
    </Paper>
  );
}

export function ActionRow({
  children,
  className,
  justify = 'flex-start',
}: ActionRowProps) {
  return (
    <Group
      gap="sm"
      justify={justify}
      wrap="wrap"
      {...(className ? { className } : {})}
    >
      {children}
    </Group>
  );
}

export function AppButton({
  children,
  disabled,
  fullWidth,
  leftSection,
  loading,
  onClick,
  rightSection,
  size,
  tone = 'secondary',
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <Button
      {...getActionToneProps(tone)}
      type={type}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(fullWidth !== undefined ? { fullWidth } : {})}
      {...(leftSection !== undefined ? { leftSection } : {})}
      {...(loading !== undefined ? { loading } : {})}
      {...(onClick !== undefined ? { onClick } : {})}
      {...(rightSection !== undefined ? { rightSection } : {})}
      {...(size !== undefined ? { size } : {})}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AppLinkButton({
  children,
  fullWidth,
  leftSection,
  loading,
  onClick,
  rightSection,
  size,
  state,
  tone = 'secondary',
  to,
  ...props
}: AppLinkButtonProps) {
  return (
    <Button
      {...getActionToneProps(tone)}
      component={Link}
      state={state}
      to={to}
      {...(fullWidth !== undefined ? { fullWidth } : {})}
      {...(leftSection !== undefined ? { leftSection } : {})}
      {...(loading !== undefined ? { loading } : {})}
      {...(onClick !== undefined ? { onClick } : {})}
      {...(rightSection !== undefined ? { rightSection } : {})}
      {...(size !== undefined ? { size } : {})}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AppBadge({ children, tone = 'default' }: AppBadgeProps) {
  return (
    <Badge {...getBadgeToneProps(tone)} w="fit-content">
      {children}
    </Badge>
  );
}

export function BrandLink({ heading, kicker, to = '/' }: BrandLinkProps) {
  return (
    <Box
      className={cn(css.brandLink)}
      component={Link}
      miw={0}
      td="none"
      to={to}
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          color="archive"
          radius="md"
          size={36}
          variant="filled"
          className={cn(css.brandMark)}
        >
          <Text
            c="white"
            fw={900}
            size="xs"
            style={{ letterSpacing: '-0.05em', fontFeatureSettings: '"ss01"' }}
          >
            WA
          </Text>
        </ThemeIcon>
        <Stack gap={0} miw={0}>
          <Text
            c="dimmed"
            fw={700}
            size="xs"
            tt="uppercase"
            style={{ letterSpacing: '0.10em', fontSize: '0.68rem' }}
          >
            {kicker}
          </Text>
          <Text
            fw={800}
            size="md"
            style={{
              letterSpacing: '-0.025em',
              color: 'var(--app-text-primary)',
              lineHeight: 1.2,
            }}
          >
            {heading}
          </Text>
        </Stack>
      </Group>
    </Box>
  );
}

export function ThemeToggleControl({
  fullWidth = false,
}: ThemeToggleControlProps) {
  const { t } = useAppTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const nextColorScheme = colorScheme === 'dark' ? 'light' : 'dark';

  return (
    <AppButton
      aria-label={
        nextColorScheme === 'dark'
          ? t('theme.switchToDark')
          : t('theme.switchToLight')
      }
      fullWidth={fullWidth}
      onClick={() => setColorScheme(nextColorScheme)}
      size="compact-md"
      tone="ghost"
      type="button"
    >
      {colorScheme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}
    </AppButton>
  );
}

export function AppNavLink({
  badge,
  children,
  end = false,
  fullWidth = false,
  onClick,
  state,
  to,
}: AppNavLinkProps) {
  return (
    <NavLink
      className={({ isActive }) =>
        cx(
          css.navLink,
          fullWidth && css.navLinkFull,
          isActive && css.navLinkActive,
        )
      }
      end={end}
      onClick={onClick}
      state={state}
      to={to}
    >
      <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
        <Text component="span" fw="inherit" size="sm">
          {children}
        </Text>
        {badge}
      </Group>
    </NavLink>
  );
}

export function SectionIntro({
  description,
  eyebrow,
  title,
  titleOrder = 2,
}: SectionIntroProps) {
  return (
    <Stack gap={6}>
      {eyebrow && (
        <Text
          c="var(--app-accent-primary)"
          fw={800}
          size="xs"
          tt="uppercase"
          style={{ letterSpacing: '0.08em' }}
        >
          {eyebrow}
        </Text>
      )}
      <Title order={titleOrder}>{title}</Title>
      {description && (
        <Text c="dimmed" maw="64ch">
          {description}
        </Text>
      )}
    </Stack>
  );
}

export function PageSection({
  actions,
  children,
  description,
  divider = true,
  eyebrow,
  title,
  titleOrder = 2,
}: PageSectionProps) {
  const hasIntro = eyebrow || title || description;

  return (
    <Stack
      gap="md"
      pt={divider ? 'xl' : 0}
      {...(divider
        ? { style: { borderTop: '1px solid var(--app-border-subtle)' } }
        : {})}
    >
      {(hasIntro || actions) && (
        <Flex
          align={{ base: 'stretch', md: 'flex-start' }}
          direction={{ base: 'column', md: 'row' }}
          gap="lg"
          justify="space-between"
        >
          {hasIntro && title ? (
            <SectionIntro
              description={description}
              eyebrow={eyebrow}
              title={title}
              titleOrder={titleOrder}
            />
          ) : (
            <Stack gap={6}>
              {eyebrow && (
                <Text c="dimmed" fw={800} size="xs" tt="uppercase">
                  {eyebrow}
                </Text>
              )}
              {description && <Text c="dimmed">{description}</Text>}
            </Stack>
          )}
          {actions && <ActionRow justify="flex-end">{actions}</ActionRow>}
        </Flex>
      )}
      {children}
    </Stack>
  );
}

export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <Paper
      className={cn(css.metricPill)}
      miw={120}
      p="md"
      radius="lg"
      styles={{
        root: {
          background: 'var(--app-surface-subtle)',
          borderColor: 'var(--app-border-subtle)',
          transition: [
            'border-color var(--wa-motion-fast, 150ms)',
            'transform var(--wa-motion-normal, 240ms)',
            'box-shadow var(--wa-motion-normal, 240ms)',
          ].join(', '),
          '&:hover': {
            borderColor: 'var(--app-border-default)',
            transform: 'translateY(-2px)',
            boxShadow: 'var(--wa-shadow-card)',
          },
        },
      }}
      withBorder
    >
      <Stack gap={4}>
        <Text
          fw={700}
          size="xs"
          tt="uppercase"
          style={{
            letterSpacing: '0.08em',
            color: 'var(--app-text-muted)',
            fontSize: 'var(--app-type-meta)',
          }}
        >
          {label}
        </Text>
        <Text
          fw={800}
          size="lg"
          style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.02em' }}
        >
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

export function ChipSummary({
  emptyLabel = appI18n.t('common.none'),
  label,
  values,
}: ChipSummaryProps) {
  return (
    <Stack gap={6}>
      <Text c="dimmed" fw={800} size="xs">
        {label}
      </Text>
      {values.length > 0 ? (
        <ActionRow>
          {values.map((value, index) => (
            <AppBadge key={`${String(value)}-${index}`} tone="muted">
              {value}
            </AppBadge>
          ))}
        </ActionRow>
      ) : (
        <Text c="dimmed" size="sm">
          {emptyLabel}
        </Text>
      )}
    </Stack>
  );
}

export function StatCard({
  accent = false,
  description,
  label,
  to,
  value,
}: StatCardProps) {
  const content = (
    <Stack gap={6}>
      <Text
        fw={700}
        size="xs"
        tt="uppercase"
        style={{
          letterSpacing: '0.08em',
          color: accent ? 'var(--app-accent-primary)' : 'var(--app-text-muted)',
          fontSize: 'var(--app-type-meta)',
        }}
      >
        {label}
      </Text>
      <Title
        order={3}
        style={{ letterSpacing: '-0.03em', color: 'var(--app-text-primary)' }}
      >
        {value}
      </Title>
      {description && (
        <Text size="sm" style={{ color: 'var(--app-text-muted)' }}>
          {description}
        </Text>
      )}
    </Stack>
  );

  return to ? (
    <SurfaceLinkCard padding="lg" to={to} tone={accent ? 'hero' : 'subtle'}>
      {content}
    </SurfaceLinkCard>
  ) : (
    <SectionCard gap={6} padding="lg" tone={accent ? 'hero' : 'subtle'}>
      {content}
    </SectionCard>
  );
}

export function KeyValueGrid({ columns = 2, items }: KeyValueGridProps) {
  return (
    <Paper
      component="dl"
      m={0}
      p={0}
      radius={0}
      styles={{ root: { background: 'transparent', border: 'none' } }}
      withBorder={false}
    >
      <SimpleGrid cols={getResponsiveColumns(columns)} spacing="lg">
        {items.map((item, index) => (
          <Stack
            gap={6}
            key={index}
            pb="sm"
            style={{ borderBottom: '1px solid var(--app-border-subtle)' }}
          >
            <Text c="dimmed" component="dt" fw={700} size="xs">
              {item.label}
            </Text>
            <Text component="dd" fw={700} m={0}>
              {item.value}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

export function ActionBar({
  actions,
  children,
  description,
  eyebrow,
  title,
}: ActionBarProps) {
  return (
    <SectionCard padding="lg" tone="subtle">
      <PageSection
        actions={actions}
        description={description}
        divider={false}
        eyebrow={eyebrow}
        title={title}
        titleOrder={3}
      >
        {children}
      </PageSection>
    </SectionCard>
  );
}

export function FeedbackMessage({
  children,
  title,
  tone = 'error',
}: FeedbackMessageProps) {
  const color = getMessageColor(tone);

  return (
    <Paper
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(css.feedback)}
      p="md"
      radius="lg"
      role={tone === 'error' ? 'alert' : 'status'}
      styles={{
        root: {
          backgroundColor: `var(--mantine-color-${color}-light)`,
          borderColor: `var(--mantine-color-${color}-light-color)`,
          color: `var(--mantine-color-${color}-light-color)`,
        },
      }}
      withBorder
    >
      <Stack gap={4}>
        {title && (
          <Text c="inherit" fw={800}>
            {title}
          </Text>
        )}
        {typeof children === 'string' ? (
          <Text c="inherit">{children}</Text>
        ) : (
          children
        )}
      </Stack>
    </Paper>
  );
}

export function StateMessage({
  actions,
  description,
  eyebrow,
  title,
  tone = 'info',
}: StateMessageProps) {
  return (
    <SectionCard className={cn(css.stateMessage)} padding="xl" tone="subtle">
      <Stack gap="md">
        <AppBadge
          tone={
            tone === 'error'
              ? 'danger'
              : tone === 'success'
                ? 'success'
                : 'accent'
          }
        >
          {eyebrow ?? getMessageLabel(tone)}
        </AppBadge>
        <Title order={2}>{title}</Title>
        <Text c="dimmed" maw="58ch">
          {description}
        </Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </Stack>
    </SectionCard>
  );
}

export function LoadingState({
  actionWidth = 136,
  rows = 3,
  title = appI18n.t('shared.loadingContent'),
}: LoadingStateProps) {
  return (
    <SectionCard padding="xl" tone="subtle">
      <Stack aria-busy="true" aria-live="polite" gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Stack flex={1} gap={8} miw={0}>
            <Skeleton height={12} radius="sm" width={96} />
            <Text c="dimmed" fw={800}>
              {title}
            </Text>
          </Stack>
          <Skeleton
            height={36}
            radius="sm"
            visibleFrom="sm"
            width={actionWidth}
          />
        </Group>
        <LoadingRows rows={rows} />
      </Stack>
    </SectionCard>
  );
}

export function LoadingRows({ rows = 3 }: LoadingRowsProps) {
  return (
    <Stack aria-busy="true" aria-live="polite" gap="sm">
      {Array.from({ length: rows }, (_, index) => (
        <Paper
          className={cn(css.loadingRow)}
          key={index}
          p="md"
          radius="lg"
          styles={{ root: { backgroundColor: 'var(--app-surface-subtle)' } }}
          withBorder
        >
          <Group gap="md" wrap="nowrap">
            <Skeleton height={84} radius="md" width={62} />
            <Stack flex={1} gap="xs" miw={0}>
              <Skeleton height={14} radius="sm" width="55%" />
              <Skeleton height={10} radius="sm" width="78%" />
              <Skeleton height={10} radius="sm" width="42%" />
            </Stack>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

export function PageHeader({
  actions,
  aside,
  className,
  description,
  eyebrow,
  meta,
  title,
  titleOrder = 2,
}: PageHeaderProps) {
  return (
    <Stack className={cx(css.pageHeader, className)} gap="lg">
      <Flex
        align={{ base: 'stretch', md: 'flex-start' }}
        direction={{ base: 'column', md: 'row' }}
        gap="xl"
        justify="space-between"
      >
        <Stack gap="md" maw={760} miw={0}>
          <SectionIntro
            description={description}
            eyebrow={eyebrow}
            title={title}
            titleOrder={titleOrder}
          />
          {meta && (
            <Group align="stretch" gap="xl" wrap="wrap">
              {meta}
            </Group>
          )}
        </Stack>
        {(aside || actions) && (
          <Stack gap="md" maw={360} miw={0}>
            {aside}
            {actions && <ActionRow justify="flex-end">{actions}</ActionRow>}
          </Stack>
        )}
      </Flex>
    </Stack>
  );
}
