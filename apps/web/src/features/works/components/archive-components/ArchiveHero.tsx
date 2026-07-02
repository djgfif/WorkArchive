import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import { cn, css, cx } from './styles';

interface ArchiveHeroProps {
  actions?: ReactNode;
  children?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  variant?: 'default' | 'compact' | 'landing';
  visual?: ReactNode;
}

function HeroEyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      className={cn(css.heroEyebrow)}
      fw={700}
      size="xs"
      tt="uppercase"
    >
      {children}
    </Text>
  );
}

function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <Title
      className={cn(css.heroTitle)}
      order={1}
    >
      {children}
    </Title>
  );
}

function HeroDescription({ children }: { children: ReactNode }) {
  return (
    <Text
      className={cn(css.heroDescription)}
      size="lg"
    >
      {children}
    </Text>
  );
}

export function ArchiveHero({
  actions,
  children,
  description,
  eyebrow,
  title,
  variant = 'default',
  visual,
}: ArchiveHeroProps) {
  return (
    <Paper
      className={cx(
        cn(css.hero),
        variant === 'compact' && cn(css.heroCompact),
        variant === 'landing' && cn(css.heroLanding),
      )}
      withBorder
    >
      <Stack className={cn(css.heroContent)} gap="xl">
        {visual ? (
          <Box className={cn(css.heroLayout)}>
            <Stack className={cn(css.heroTextColumn)} gap="lg">
              <Stack gap="sm">
                {eyebrow && <HeroEyebrow>{eyebrow}</HeroEyebrow>}
                <HeroTitle>{title}</HeroTitle>
                <HeroDescription>{description}</HeroDescription>
              </Stack>
              {children}
              {actions && (
                <Group gap="sm" wrap="wrap">
                  {actions}
                </Group>
              )}
            </Stack>
            <Box className={cn(css.heroVisual)}>{visual}</Box>
          </Box>
        ) : (
          <>
            <Group align="flex-start" justify="space-between" wrap="wrap">
              <Stack gap="sm" maw={760}>
                {eyebrow && <HeroEyebrow>{eyebrow}</HeroEyebrow>}
                <HeroTitle>{title}</HeroTitle>
                <HeroDescription>{description}</HeroDescription>
              </Stack>
              {actions}
            </Group>
            {children}
          </>
        )}
      </Stack>
    </Paper>
  );
}
