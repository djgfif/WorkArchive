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

interface AppLinkButtonProps extends Omit<AppButtonProps, 'onClick' | 'type'> {
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
  if (tone === 'hero') {
    return [
      'radial-gradient(circle at 82% 18%, rgba(169, 152, 240, 0.16), transparent 32%)',
      'linear-gradient(145deg, var(--app-surface-hero), var(--app-bg-elevated))',
    ].join(', ');
  }

  return tone === 'subtle' ? 'var(--app-surface-subtle)' : 'var(--app-surface-card)';
}

function getActionToneProps(tone: AppActionTone) {
  switch (tone) {
    case 'primary':
      return {
        color: 'archive',
        gradient: { deg: 135, from: 'archive.3', to: 'archive.6' },
        variant: 'gradient',
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

function getMessageLabel(tone: MessageTone) {
  switch (tone) {
    case 'success':
      return '완료';
    case 'loading':
      return '불러오는 중';
    case 'error':
      return '문제 발생';
    case 'info':
    default:
      return '안내';
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

export function PageShell({ children, gap = 'xl', size = 1240 }: PageShellProps) {
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
      radius={tone === 'hero' ? 'xl' : 'lg'}
      styles={{
        root: {
          background: getSurfaceBackground(tone),
          borderColor: tone === 'hero' ? 'var(--app-border-strong)' : 'var(--app-border-subtle)',
          boxShadow: tone === 'hero' ? 'var(--app-shadow-card)' : 'none',
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
          transition: 'transform 160ms ease, border-color 160ms ease, background 160ms ease',
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

export function ActionRow({ children, className, justify = 'flex-start' }: ActionRowProps) {
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

export function AppBadge({ children, tone = 'default' }: AppBadgeProps) {
  return (
    <Badge {...getBadgeToneProps(tone)} w="fit-content">
      {children}
    </Badge>
  );
}

export function BrandLink({ heading, kicker, to = '/' }: BrandLinkProps) {
  return (
    <Box component={Link} display="inline-flex" miw={0} td="none" to={to}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon color="archive" radius="md" size={38} variant="light">
          <Text fw={800} size="xs">WA</Text>
        </ThemeIcon>
        <Stack gap={0} miw={0}>
          <Text c="dimmed" fw={800} size="xs" tt="uppercase">
            {kicker}
          </Text>
          <Text fw={800} size="md">
            {heading}
          </Text>
        </Stack>
      </Group>
    </Box>
  );
}

export function ThemeToggleControl({ fullWidth = false }: ThemeToggleControlProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const nextColorScheme = colorScheme === 'dark' ? 'light' : 'dark';

  return (
    <AppButton
      aria-label={`${nextColorScheme === 'dark' ? '다크' : '라이트'} 모드로 전환`}
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
      onClick={onClick}
      style={({ isActive }) => ({
        alignItems: 'center',
        background: fullWidth && isActive ? 'var(--app-surface-subtle)' : 'transparent',
        border: fullWidth
          ? `1px solid ${isActive ? 'var(--app-border-strong)' : 'transparent'}`
          : '1px solid transparent',
        borderRadius: fullWidth ? 'var(--mantine-radius-md)' : undefined,
        color: isActive ? 'var(--app-text-primary)' : 'var(--app-text-secondary)',
        display: fullWidth ? 'flex' : 'inline-flex',
        gap: '0.625rem',
        justifyContent: 'space-between',
        padding: fullWidth ? '0.82rem 0.95rem' : '0.45rem 0.2rem',
        textDecoration: 'none',
        transition: 'border-color 160ms ease, background 160ms ease, color 160ms ease',
        width: fullWidth ? '100%' : undefined,
      })}
      to={to}
    >
      <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
        <Text component="span" fw={700}>
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
        <Text c="var(--app-accent-primary)" fw={800} size="xs" tt="uppercase">
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
      {...(divider ? { style: { borderTop: '1px solid var(--app-border-subtle)' } } : {})}
    >
      {(hasIntro || actions) && (
        <Flex
          align={{ base: 'stretch', md: 'flex-start' }}
          direction={{ base: 'column', md: 'row' }}
          gap="lg"
          justify="space-between"
        >
          {hasIntro && title ? (
            <SectionIntro description={description} eyebrow={eyebrow} title={title} titleOrder={titleOrder} />
          ) : (
            <Stack gap={6}>
              {eyebrow && <Text c="dimmed" fw={800} size="xs" tt="uppercase">{eyebrow}</Text>}
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
    <Paper miw={112} p="sm" radius="md" styles={{ root: { background: 'var(--app-surface-subtle)' } }} withBorder>
      <Stack gap={2}>
        <Text c="dimmed" fw={800} size="xs" tt="uppercase">
          {label}
        </Text>
        <Text fw={800} size="md">
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

export function ChipSummary({ emptyLabel = '없음', label, values }: ChipSummaryProps) {
  return (
    <Stack gap={6}>
      <Text c="dimmed" fw={800} size="xs">{label}</Text>
      {values.length > 0 ? (
        <ActionRow>
          {values.map((value, index) => (
            <AppBadge key={`${String(value)}-${index}`} tone="muted">{value}</AppBadge>
          ))}
        </ActionRow>
      ) : (
        <Text c="dimmed" size="sm">{emptyLabel}</Text>
      )}
    </Stack>
  );
}

export function StatCard({ accent = false, description, label, to, value }: StatCardProps) {
  const content = (
    <Stack gap={6}>
      <Text c={accent ? 'archive.2' : 'dimmed'} fw={800} size="xs" tt="uppercase">{label}</Text>
      <Title order={3}>{value}</Title>
      {description && <Text c="dimmed">{description}</Text>}
    </Stack>
  );

  return to ? (
    <SurfaceLinkCard padding="lg" to={to} tone={accent ? 'hero' : 'subtle'}>{content}</SurfaceLinkCard>
  ) : (
    <SectionCard gap={6} padding="lg" tone={accent ? 'hero' : 'subtle'}>{content}</SectionCard>
  );
}

export function KeyValueGrid({ columns = 2, items }: KeyValueGridProps) {
  return (
    <Paper component="dl" m={0} p={0} radius={0} styles={{ root: { background: 'transparent', border: 'none' } }} withBorder={false}>
      <SimpleGrid cols={getResponsiveColumns(columns)} spacing="lg">
        {items.map((item, index) => (
          <Stack gap={6} key={index} pb="sm" style={{ borderBottom: '1px solid var(--app-border-subtle)' }}>
            <Text c="dimmed" component="dt" fw={700} size="xs">{item.label}</Text>
            <Text component="dd" fw={700} m={0}>{item.value}</Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

export function ActionBar({ actions, children, description, eyebrow, title }: ActionBarProps) {
  return (
    <SectionCard padding="lg" tone="subtle">
      <PageSection actions={actions} description={description} divider={false} eyebrow={eyebrow} title={title} titleOrder={3}>
        {children}
      </PageSection>
    </SectionCard>
  );
}

export function FeedbackMessage({ children, title, tone = 'error' }: FeedbackMessageProps) {
  const color = getMessageColor(tone);

  return (
    <Paper
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
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
        {title && <Text c="inherit" fw={800}>{title}</Text>}
        {typeof children === 'string' ? <Text c="inherit">{children}</Text> : children}
      </Stack>
    </Paper>
  );
}

export function StateMessage({ actions, description, eyebrow, title, tone = 'info' }: StateMessageProps) {
  return (
    <SectionCard padding="xl" tone="subtle">
      <Stack gap="md">
        <AppBadge tone={tone === 'error' ? 'danger' : tone === 'success' ? 'success' : 'accent'}>
          {eyebrow ?? getMessageLabel(tone)}
        </AppBadge>
        <Title order={2}>{title}</Title>
        <Text c="dimmed" maw="58ch">{description}</Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </Stack>
    </SectionCard>
  );
}

export function LoadingState({ actionWidth = 136, rows = 3, title = '콘텐츠를 불러오는 중입니다' }: LoadingStateProps) {
  return (
    <SectionCard padding="xl" tone="subtle">
      <Stack aria-busy="true" aria-live="polite" gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Stack flex={1} gap={8} miw={0}>
            <Skeleton height={12} radius="sm" width={96} />
            <Text c="dimmed" fw={800}>{title}</Text>
          </Stack>
          <Skeleton height={36} radius="sm" visibleFrom="sm" width={actionWidth} />
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
        <Paper key={index} p="md" radius="lg" styles={{ root: { backgroundColor: 'var(--app-surface-subtle)' } }} withBorder>
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
    <Stack
      gap="lg"
      pb="lg"
      style={{ borderBottom: '1px solid var(--app-border-subtle)' }}
      {...(className ? { className } : {})}
    >
      <Flex align={{ base: 'stretch', md: 'flex-start' }} direction={{ base: 'column', md: 'row' }} gap="xl" justify="space-between">
        <Stack gap="md" maw={760} miw={0}>
          <SectionIntro description={description} eyebrow={eyebrow} title={title} titleOrder={titleOrder} />
          {meta && <Group align="stretch" gap="xl" wrap="wrap">{meta}</Group>}
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
