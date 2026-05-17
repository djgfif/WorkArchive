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
  ThemeIcon,
  Title,
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
  'aria-pressed'?: boolean;
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
  onClick?: ComponentPropsWithoutRef<'a'>['onClick'];
  to: string;
}

function getSurfaceBackground(tone: SurfaceTone) {
  switch (tone) {
    case 'hero':
      return [
        'linear-gradient(135deg, rgba(173, 202, 222, 0.1), transparent 42%)',
        'linear-gradient(180deg, var(--app-surface-0), var(--app-surface-low))',
      ].join(', ');
    case 'subtle':
      return 'var(--app-surface-1)';
    case 'default':
    default:
      return 'var(--app-surface-0)';
  }
}

function getSurfaceBorder(tone: SurfaceTone) {
  return tone === 'hero' ? 'var(--app-border-strong)' : 'var(--app-border-color)';
}

function getActionToneProps(tone: AppActionTone) {
  switch (tone) {
    case 'primary':
      return {
        color: 'archive',
        gradient: {
          deg: 135,
          from: 'archive.2',
          to: 'archive.6',
        },
        variant: 'gradient',
      } as const;
    case 'quiet':
      return {
        color: 'gray',
        variant: 'subtle',
      } as const;
    case 'ghost':
      return {
        color: 'gray',
        variant: 'transparent',
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
  padding = 'lg',
  tone = 'default',
}: SectionCardProps) {
  return (
    <Paper
      p={padding}
      radius="md"
      styles={{
        root: {
          background: getSurfaceBackground(tone),
          borderColor: getSurfaceBorder(tone),
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
  padding = 'lg',
  to,
  tone = 'default',
}: SurfaceLinkCardProps) {
  return (
    <Paper
      component={Link}
      p={padding}
      radius="md"
      styles={{
        root: {
          background: getSurfaceBackground(tone),
          borderColor: getSurfaceBorder(tone),
          display: 'block',
          textDecoration: 'none',
          transition:
            'border-color var(--app-transition-fast), background-color var(--app-transition-fast)',
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
        minWidth: 0,
        textDecoration: 'none',
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon color="archive" radius="sm" size={36} variant="light">
          <Text fw={700} size="xs">
            WA
          </Text>
        </ThemeIcon>
        <Stack gap={0} miw={0}>
          <Text c="var(--app-text-muted)" fw={700} fz="0.7rem" lts="0.12em" tt="uppercase">
            {kicker}
          </Text>
          <Text c="var(--app-text-strong)" fw={700} fz="1rem">
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
      size="compact-md"
      tone="ghost"
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
  onClick,
  to,
}: AppNavLinkProps) {
  return (
    <NavLink
      end={end}
      {...(onClick !== undefined ? { onClick } : {})}
      style={({ isActive }) => ({
        alignItems: 'center',
        background: fullWidth && isActive ? 'var(--app-surface-1)' : 'transparent',
        borderBottom: fullWidth
          ? 'none'
          : `2px solid ${isActive ? 'var(--app-accent)' : 'transparent'}`,
        borderLeft: fullWidth
          ? `2px solid ${isActive ? 'var(--app-accent)' : 'transparent'}`
          : 'none',
        color: isActive ? 'var(--app-text-strong)' : 'var(--app-text-secondary)',
        display: fullWidth ? 'flex' : 'inline-flex',
        gap: '0.625rem',
        justifyContent: 'space-between',
        padding: fullWidth ? '0.8rem 0.95rem' : '0.45rem 0',
        textDecoration: 'none',
        transition:
          'border-color var(--app-transition-fast), background-color var(--app-transition-fast), color var(--app-transition-fast)',
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
    <Stack gap={6}>
      {eyebrow && (
        <Text c="var(--app-text-muted)" fw={700} fz="0.72rem" lts="0.12em" tt="uppercase">
          {eyebrow}
        </Text>
      )}
      <Title order={titleOrder}>{title}</Title>
      {description && (
        <Text c="var(--app-text-muted)" maw="64ch">
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
  const hasHeader = hasIntro || actions;

  return (
    <Stack
      gap="md"
      pt={divider ? 'lg' : 0}
      style={divider ? { borderTop: '1px solid var(--app-border-color)' } : undefined}
    >
      {hasHeader && (
        <Flex
          align={{ base: 'stretch', md: 'flex-start' }}
          direction={{ base: 'column', md: 'row' }}
          gap="lg"
          justify="space-between"
        >
          {hasIntro && (
            title ? (
              <SectionIntro
                description={description}
                eyebrow={eyebrow}
                title={title}
                titleOrder={titleOrder}
              />
            ) : (
              <Stack gap={6}>
                {eyebrow && (
                  <Text c="var(--app-text-muted)" fw={700} fz="0.72rem" lts="0.12em" tt="uppercase">
                    {eyebrow}
                  </Text>
                )}
                {description && <Text c="var(--app-text-muted)">{description}</Text>}
              </Stack>
            )
          )}
          {actions && <ActionRow justify="flex-end">{actions}</ActionRow>}
        </Flex>
      )}
      {children}
    </Stack>
  );
}

export function MetricPill({
  label,
  value,
}: MetricPillProps) {
  return (
    <Stack
      gap={2}
      miw={112}
      p="xs"
      style={{
        background: 'var(--app-surface-low)',
        border: '1px solid var(--app-border-subtle)',
        borderRadius: 'var(--app-surface-radius-sm)',
      }}
    >
      <Text c="var(--app-text-muted)" fw={700} fz="0.7rem" lts="0.06em" tt="uppercase">
        {label}
      </Text>
      <Text c="var(--app-text-strong)" fw={700} fz="0.95rem">
        {value}
      </Text>
    </Stack>
  );
}

export function ChipSummary({
  emptyLabel = '없음',
  label,
  values,
}: ChipSummaryProps) {
  return (
    <Stack gap={6}>
      <Text c="var(--app-text-muted)" fw={700} fz="0.76rem">
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
        <Text c="var(--app-text-muted)" size="sm">
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
      <Text c={accent ? 'var(--app-accent)' : 'var(--app-text-muted)'} fw={700} fz="0.74rem">
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
      <SimpleGrid cols={getResponsiveColumns(columns)} spacing="lg">
        {items.map((item, index) => (
          <Stack
            gap={6}
            key={index}
            pb="sm"
            style={{ borderBottom: '1px solid var(--app-border-color)' }}
          >
            <Text c="var(--app-text-muted)" component="dt" fw={600} fz="0.76rem" lts="0.04em">
              {item.label}
            </Text>
            <Text c="var(--app-text-strong)" component="dd" fw={600} m={0}>
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
  return (
    <Alert color={getMessageColor(tone)} radius="md" title={title} variant="light">
      {typeof children === 'string' ? <Text c="inherit">{children}</Text> : children}
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
    <SectionCard padding="lg" tone="subtle">
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
    <Stack
      gap="lg"
      pb="lg"
      style={{ borderBottom: '1px solid var(--app-border-color)' }}
      {...(className ? { className } : {})}
    >
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
