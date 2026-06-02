import { Paper, Stack, Text } from '@mantine/core';

import { ActionRow, AppBadge } from '@shared/components/AppPrimitives';
import {
  formatProviderNames,
  type ProviderReadinessGroup,
  type useImportProviderReadiness,
} from '@features/imports';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface ProviderGroupLineProps {
  group: ProviderReadinessGroup;
  tone?: 'accent' | 'muted' | 'success' | 'warning';
}

function ProviderGroupLine({ group, tone = 'muted' }: ProviderGroupLineProps) {
  if (group.providers.length === 0) {
    return null;
  }

  return (
    <ActionRow>
      <AppBadge tone={tone}>{group.label}</AppBadge>
      <Text c="var(--mantine-color-dimmed)" size="sm">
        {formatProviderNames(group.providers)}
      </Text>
    </ActionRow>
  );
}

interface ProviderReadinessSummaryProps {
  error: string | null;
  isLoading: boolean;
  readiness: ReturnType<typeof useImportProviderReadiness>['readiness'];
}

export function ProviderReadinessSummary({
  error,
  isLoading,
  readiness,
}: ProviderReadinessSummaryProps) {
  return (
    <Paper
      className={cn(css.providerStatusPanel)}
      p="sm"
      radius="md"
      withBorder
    >
      <Stack gap="xs">
        <ActionRow justify="space-between">
          <Text c="var(--mantine-color-text)" fw={700} size="sm">
            검색 출처 상태
          </Text>
          {isLoading && (
            <Text c="var(--mantine-color-dimmed)" size="xs">
              상태 확인 중
            </Text>
          )}
        </ActionRow>

        {error ? (
          <Text c="var(--mantine-color-dimmed)" size="sm">
            지금은 일부 검색 출처 상태를 확인하지 못했습니다. 검색과 직접 추가는
            계속 사용할 수 있습니다.
          </Text>
        ) : (
          <Stack gap={6}>
            <ProviderGroupLine group={readiness.available} tone="success" />
            <ProviderGroupLine group={readiness.circuitOpen} tone="warning" />
            <ProviderGroupLine
              group={readiness.userActionRequired}
              tone="warning"
            />
            <ProviderGroupLine
              group={readiness.serverSetupRequired}
              tone="muted"
            />
            <ProviderGroupLine group={readiness.directFallback} tone="accent" />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
