import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  ThemeIcon,
  useMantineColorScheme,
} from '@mantine/core';
import { Link, NavLink } from 'react-router-dom';

type SurfaceTone = 'default' | 'hero' | 'subtle';
type MessageTone = 'error' | 'info' | 'loading' | 'success';
type AppActionTone = 'danger' | 'ghost' | 'primary' | 'quiet' | 'secondary';
type AppBadgeTone = 'accent' | 'danger' | 'default' | 'muted' | 'success' | 'warning';

interface PageShellProps {
  children: ReactNode;
  gap?: string | number;
  size?: number;
}

interface SectionCardProps {
  children: ReactNode;
  className?: string | undefined;
  gap?: string | number;
  padding?: string | number;
  tone?: SurfaceTone;
}

interface SurfaceLinkCardProps {
  children: ReactNode;
  className?: string | undefined;
  gap?: string | number;
  padding?: string | number;
  to: string;
  tone?: SurfaceTone;
}

interface ActionRowProps {
  children: ReactNode;
  className?: string | undefined;
  justify?: 'center' | 'flex-end' | 'flex-start' | 'space-between';
}

interface SectionIntroProps {
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
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

interface StateMessageProps {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  tone?: MessageTone;
}

interface PageHeaderProps {
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string | undefined;
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
  items: Array<{
    label: ReactNode;
    value: ReactNode;
  }>;
}

interface AppButtonProps {
  'aria-label'?: string;
  children?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  leftSection?: ReactNode;
  loading?: boolean;
  onClick?: ComponentPropsWithoutRef<'button'>['onClick'];
  rightSection?: ReactNode;
  size?: 'compact-md' | 'compact-sm' | 'compact-xs' | 'lg' | 'md' | 'sm' | 'xl' | 'xs';
  tone?: AppActionTone;
  type?: ComponentPropsWithoutRef<'button'>['type'];
}

interface AppLinkButtonProps {
  'aria-label'?: string;
  children?: ReactNode;
  fullWidth?: boolean;
  leftSection?: ReactNode;
  loading?: boolean;
  rightSection?: ReactNode;
  size?: 'compact-md' | 'compact-sm' | 'compact-xs' | 'lg' | 'md' | 'sm' | 'xl' | 'xs';
  tone?: AppActionTone;
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
  to: string;
}

function getSurfaceBackground(tone: SurfaceTone) {
  switch (tone) {
    case 'hero':
      return 'var(--app-surface-1)';
    case 'subtle':
      return 'var(--app-surface-2)';
    case 'default':
    default:
      return 'var(--app-surface-0)';
  }
}

function getActionToneProps(tone: AppActionTone) {
  switch (tone) {
    case 'primary':
      return {
        color: 'archive',
        variant: 'filled',
      } as const;
    case 'quiet':
    case 'ghost':
      return {
        color: 'gray',
        variant: 'subtle',
      } as const;
    case 'danger':
      return {
        color: 'red',
        variant: 'light',
      } as const;
    case 'secondary':
    default:
      return {
        variant: 'default',
      } as const;
  }
}

function getBadgeToneProps(tone: AppBadgeTone) {
  switch (tone) {
    case 'accent':
      return { color: 'archive' } as const;
    case 'danger':
      return { color: 'red' } as const;
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

function getMessageColor(tone: MessageTone) {
  switch (tone) {
    case 'success':
      return 'teal';
    case 'loading':
      return 'blue';
    case 'info':
      return 'gray';
    case 'error':
    default:
      return 'red';
  }
}

function getMessageLabel(tone: MessageTone) {
  switch (tone) {
    case 'success':
      return '완료';
    case 'loading':
      return '불러오는 중';
    case 'info':
      return '안내';
    case 'error':
    default:
      return '문제 발생';
  }
}

function getResponsiveColumns(columns: 1 | 2 | 3) {
  if (columns === 1) {
    return { base: 1 };
  }

  if (columns === 3) {
    return { base: 1, lg: 3, sm: 2 };
  }

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
  padding = 'xl',
  tone = 'default',
}: SectionCardProps) {
  return (
    <Paper
      p={padding}
      radius="xl"
      styles={{
        root: {
          backgroundColor: getSurfaceBackground(tone),
          borderColor:
            tone === 'hero' ? 'var(--app-border-strong)' : 'var(--app-border-color)',
          overflow: 'hidden',
        },
      }}
      {...(className ? { className } : {})}
      withBorder
    >
      <Stack gap={gap}>{children}</Stack>
    </Paper>
  );
}

export function SurfaceLinkCard({
  children,
  className,
  gap = 'md',
  padding = 'xl',
  to,
  tone = 'default',
}: SurfaceLinkCardProps) {
  return (
    <Paper
      component={Link}
      p={padding}
      radius="xl"
      styles={{
        root: {
          backgroundColor: getSurfaceBackground(tone),
          borderColor:
            tone === 'hero' ? 'var(--app-border-strong)' : 'var(--app-border-color)',
          display: 'block',
          textDecoration: 'none',
          transition:
            'transform var(--app-transition-fast), border-color var(--app-transition-fast), background-color var(--app-transition-fast)',
        },
      }}
      to={to}
      {...(className ? { className } : {})}
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
    <Group gap="sm" justify={justify} wrap="wrap" {...(className ? { className } : {})}>
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
  rightSection,
  size,
  tone = 'secondary',
  to,
  ...props
}: AppLinkButtonProps) {
  return (
    <Button
      {...getActionToneProps(tone)}
      component={Link}
      to={to}
      {...(fullWidth !== undefined ? { fullWidth } : {})}
      {...(leftSection !== undefined ? { leftSection } : {})}
      {...(loading !== undefined ? { loading } : {})}
      {...(rightSection !== undefined ? { rightSection } : {})}
      {...(size !== undefined ? { size } : {})}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AppBadge({
  children,
  tone = 'default',
}: AppBadgeProps) {
  return (
    <Badge {...getBadgeToneProps(tone)} w="fit-content">
      {children}
    </Badge>
  );
}

export function BrandLink({
  heading,
  kicker,
  to = '/',
}: BrandLinkProps) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        textDecoration: 'none',
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon radius="lg" size={42} variant="light">
          <Text fw={700} size="sm">
            WA
          </Text>
        </ThemeIcon>
        <Stack gap={1}>
          <Text c="var(--app-accent)" fw={700} fz="0.74rem" lts="0.12em" tt="uppercase">
            {kicker}
          </Text>
          <Text c="var(--app-text-strong)" fw={700} fz="1.02rem">
            {heading}
          </Text>
        </Stack>
      </Group>
    </Link>
  );
}

export function ThemeToggleControl({
  fullWidth = false,
}: ThemeToggleControlProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const nextColorScheme = colorScheme === 'dark' ? 'light' : 'dark';

  return (
    <AppButton
      fullWidth={fullWidth}
      onClick={() => setColorScheme(nextColorScheme)}
      tone="quiet"
      type="button"
    >
      {colorScheme === 'dark' ? '라이트 모드' : '다크 모드'}
    </AppButton>
  );
}

export function AppNavLink({
  badge,
  children,
  end = false,
  fullWidth = false,
  to,
}: AppNavLinkProps) {
  return (
    <NavLink
      end={end}
      style={({ isActive }) => ({
        alignItems: 'center',
        background: isActive ? 'var(--app-accent-soft)' : 'var(--app-surface-1)',
        border: `1px solid ${isActive ? 'var(--app-border-strong)' : 'var(--app-border-color)'}`,
        borderRadius: '1rem',
        color: isActive ? 'var(--app-text-strong)' : 'var(--app-text-secondary)',
        display: fullWidth ? 'flex' : 'inline-flex',
        gap: '0.625rem',
        justifyContent: 'space-between',
        minHeight: '42px',
        padding: '0.75rem 1rem',
        textDecoration: 'none',
        transition:
          'transform var(--app-transition-fast), border-color var(--app-transition-fast), background-color var(--app-transition-fast), color var(--app-transition-fast)',
        width: fullWidth ? '100%' : undefined,
      })}
      to={to}
    >
      <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
        <Text component="span" fw={600}>
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
    <Stack gap={8}>
      {eyebrow && (
        <Text c="var(--app-accent)" fw={700} fz="0.76rem" lts="0.12em" tt="uppercase">
          {eyebrow}
        </Text>
      )}
      <Title order={titleOrder}>{title}</Title>
      {description && (
        <Text c="var(--app-text-muted)" maw="60ch">
          {description}
        </Text>
      )}
    </Stack>
  );
}

export function MetricPill({
  label,
  value,
}: MetricPillProps) {
  return (
    <Paper
      p="md"
      radius="lg"
      styles={{
        root: {
          backgroundColor: 'var(--app-surface-2)',
          borderColor: 'var(--app-border-color)',
        },
      }}
      withBorder
    >
      <Stack gap={2}>
        <Text c="var(--app-text-strong)" fw={700} fz="0.96rem">
          {value}
        </Text>
        <Text c="var(--app-text-muted)" fz="0.8rem">
          {label}
        </Text>
      </Stack>
    </Paper>
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
      <Text c={accent ? 'var(--app-accent)' : 'var(--app-text-muted)'} fw={700} fz="0.78rem">
        {label}
      </Text>
      <Title order={3}>{value}</Title>
      {description && <Text c="var(--app-text-muted)">{description}</Text>}
    </Stack>
  );

  if (to) {
    return (
      <SurfaceLinkCard padding="lg" to={to} tone={accent ? 'hero' : 'subtle'}>
        {content}
      </SurfaceLinkCard>
    );
  }

  return (
    <SectionCard gap={6} padding="lg" tone={accent ? 'hero' : 'subtle'}>
      {content}
    </SectionCard>
  );
}

export function KeyValueGrid({
  columns = 2,
  items,
}: KeyValueGridProps) {
  return (
    <Paper
      component="dl"
      m={0}
      p={0}
      radius={0}
      styles={{ root: { background: 'transparent', border: 'none' } }}
      withBorder={false}
    >
      <SimpleGrid cols={getResponsiveColumns(columns)} spacing="md">
        {items.map((item, index) => (
          <Paper
            key={index}
            p="md"
            radius="lg"
            styles={{
              root: {
                backgroundColor: 'var(--app-surface-1)',
                borderColor: 'var(--app-border-color)',
              },
            }}
            withBorder
          >
            <Text c="var(--app-text-muted)" component="dt" fw={600} fz="0.8rem">
              {item.label}
            </Text>
            <Text c="var(--app-text-strong)" component="dd" fw={600} m={0} mt={6}>
              {item.value}
            </Text>
          </Paper>
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
    <SectionCard tone="subtle">
      <Stack gap="md">
        <Flex
          align={{ base: 'stretch', md: 'flex-start' }}
          direction={{ base: 'column', md: 'row' }}
          gap="lg"
          justify="space-between"
        >
          <SectionIntro
            description={description}
            eyebrow={eyebrow}
            title={title}
            titleOrder={3}
          />
          {actions && <ActionRow justify="flex-end">{actions}</ActionRow>}
        </Flex>
        {children}
      </Stack>
    </SectionCard>
  );
}

export function FeedbackMessage({
  children,
  title,
  tone = 'error',
}: FeedbackMessageProps) {
  return (
    <Alert color={getMessageColor(tone)} radius="lg" title={title} variant="light">
      <Text c="inherit">{children}</Text>
    </Alert>
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
    <SectionCard tone="subtle">
      <Stack gap="md">
        <AppBadge tone={tone === 'error' ? 'danger' : tone === 'success' ? 'success' : 'accent'}>
          {eyebrow ?? getMessageLabel(tone)}
        </AppBadge>
        <Title order={2}>{title}</Title>
        <Text c="var(--app-text-muted)" maw="56ch">
          {description}
        </Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </Stack>
    </SectionCard>
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
    <SectionCard tone="hero" {...(className ? { className } : {})}>
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
            <Group gap="sm" wrap="wrap">
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
    </SectionCard>
  );
}
