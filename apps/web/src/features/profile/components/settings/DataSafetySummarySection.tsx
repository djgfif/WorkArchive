import { Group, Stack, Text } from '@mantine/core';

import {
  AppBadge,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import type { DataSafetyViewModel } from '../../utils/data-safety-view-model';

interface DataSafetySummarySectionProps {
  viewModel: DataSafetyViewModel;
}

export function DataSafetySummarySection({
  viewModel,
}: DataSafetySummarySectionProps) {
  const { t } = useAppTranslation();
  const toneLabel = {
    info: t('settings.dataSafety.tone.info'),
    muted: t('settings.dataSafety.tone.muted'),
    success: t('settings.dataSafety.tone.success'),
    warning: t('settings.dataSafety.tone.warning'),
  }[viewModel.tone];

  return (
    <SectionCard tone="hero">
      <Group align="flex-start" justify="space-between" wrap="wrap">
        <SectionIntro
          description={viewModel.description}
          eyebrow={t('settings.dataSafety.eyebrow')}
          title={viewModel.title}
        />
        <AppBadge tone={viewModel.tone}>{toneLabel}</AppBadge>
      </Group>

      <KeyValueGrid
        columns={3}
        items={[
          {
            label: t('settings.dataSafety.localRecordLabel'),
            value: viewModel.localRecordLabel,
          },
          {
            label: t('settings.dataSafety.lastJsonBackupLabel'),
            value: viewModel.lastJsonBackupLabel,
          },
          {
            label: t('settings.dataSafety.localStorageLabel'),
            value: viewModel.storageLabel,
          },
          {
            label: t('settings.dataSafety.autoBackupLabel'),
            value: viewModel.autoBackupLabel,
          },
          {
            label: t('settings.dataSafety.accountBackupLabel'),
            value: viewModel.accountBackupLabel,
          },
        ]}
      />

      <Stack gap="xs">
        <Text fw={800} size="sm">
          {t('settings.dataSafety.requiredActions')}
        </Text>
        <Group gap="xs" wrap="wrap">
          {viewModel.actions.length > 0 ? (
            viewModel.actions.map((action) => (
              <AppBadge key={action.label} tone={action.tone}>
                {action.label}
              </AppBadge>
            ))
          ) : (
            <AppBadge tone="success">
              {t('settings.dataSafety.noActionRequired')}
            </AppBadge>
          )}
        </Group>
      </Stack>
    </SectionCard>
  );
}
