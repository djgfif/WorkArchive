import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Container,
  Flex,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';

type SurfaceTone = 'default' | 'hero' | 'subtle';
type MessageTone = 'error' | 'info' | 'loading' | 'success';

interface PageShellProps {
  children: ReactNode;
  size?: number;
}

interface SectionCardProps {
  children: ReactNode;
  className?: string | undefined;
  gap?: string | number;
  padding?: string | number;
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

interface MetricPillProps {
  label: ReactNode;
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

function getSurfaceStyle(tone: SurfaceTone) {
  if (tone === 'hero') {
    return {
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 34%), rgba(8, 15, 28, 0.88)',
    } as const;
  }

  if (tone === 'subtle') {
    return {
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 28%), rgba(8, 15, 28, 0.78)',
    } as const;
  }

  return {
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%), rgba(10, 18, 34, 0.84)',
  } as const;
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

export function PageShell({ children, size = 1240 }: PageShellProps) {
  return (
    <Container px={0} size={size} w="100%">
      <Stack gap="xl">{children}</Stack>
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
      radius={30}
      style={getSurfaceStyle(tone)}
      styles={{
        root: {
          border: '1px solid rgba(148, 163, 184, 0.14)',
          boxShadow: '0 28px 80px rgba(2, 6, 23, 0.36)',
          overflow: 'hidden',
        },
      }}
      withBorder
      {...(className ? { className } : {})}
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

export function SectionIntro({
  description,
  eyebrow,
  title,
  titleOrder = 2,
}: SectionIntroProps) {
  return (
    <Stack gap={8}>
      {eyebrow && (
        <Text c="var(--accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
          {eyebrow}
        </Text>
      )}
      <Title c="var(--text-primary)" order={titleOrder}>
        {title}
      </Title>
      {description && (
        <Text c="var(--text-muted)" maw="56ch">
          {description}
        </Text>
      )}
    </Stack>
  );
}

export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <Paper
      p="sm"
      radius="xl"
      style={{
        background: 'rgba(148, 163, 184, 0.08)',
      }}
      styles={{
        root: {
          border: '1px solid rgba(148, 163, 184, 0.1)',
        },
      }}
      withBorder
    >
      <Stack gap={4}>
        <Text c="var(--text-primary)" fw={700} fz="0.95rem">
          {value}
        </Text>
        <Text c="var(--text-muted)" fz="0.82rem">
          {label}
        </Text>
      </Stack>
    </Paper>
  );
}

export function FeedbackMessage({
  children,
  title,
  tone = 'error',
}: FeedbackMessageProps) {
  return (
    <Alert color={getMessageColor(tone)} radius="xl" title={title} variant="light">
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
        <Badge color={getMessageColor(tone)} radius="xl" variant="light" w="fit-content">
          {eyebrow ?? getMessageLabel(tone)}
        </Badge>
        <Title c="var(--text-primary)" order={2}>
          {title}
        </Title>
        <Text c="var(--text-muted)" maw="56ch">
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
        <Stack gap="md" maw={720} miw={0}>
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
          <Stack gap="md">
            {aside}
            {actions && <ActionRow justify="flex-end">{actions}</ActionRow>}
          </Stack>
        )}
      </Flex>
    </SectionCard>
  );
}
