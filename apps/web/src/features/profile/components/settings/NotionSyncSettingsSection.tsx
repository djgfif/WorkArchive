import {
  Box,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { FormEvent } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
  type AppTranslationKey,
} from '@app/i18n';
import type { NotionChangePreview } from '../../services/notion.service';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

const css = styles;
type TranslationFn = ReturnType<typeof useAppTranslation>['t'];

interface NotionSyncSettingsSectionProps {
  connectionDraft: {
    dataSourceId: string;
    token: string;
  };
  feedback: SettingsFeedback | null;
  isApplyingPull: boolean;
  isDeletingConnection: boolean;
  isLoadingStatus: boolean;
  isPreviewingPull: boolean;
  isPushing: boolean;
  isSavingConnection: boolean;
  isTestingConnection: boolean;
  mode: 'authenticated' | 'guest';
  onApplyPull: () => void;
  onDeleteConnection: () => void;
  onPreviewPull: () => void;
  onPushToNotion: () => void;
  onSaveConnection: () => void;
  onTestConnection: () => void;
  onUpdateConnectionDraft: (
    field: 'dataSourceId' | 'token',
    value: string,
  ) => void;
  pullPreview: {
    changes: NotionChangePreview[];
    total: number;
  } | null;
  status: {
    configured: boolean;
    dataSourceId: string | null;
    lastSyncedAt: string | null;
    mappedCount: number;
  } | null;
}

const fieldLabelKeys: Record<string, AppTranslationKey> = {
  completedAt: 'settings.notion.fields.completedAt',
  droppedAt: 'settings.notion.fields.droppedAt',
  favorite: 'settings.notion.fields.favorite',
  personalTags: 'settings.notion.fields.personalTags',
  progressCurrent: 'settings.notion.fields.progressCurrent',
  progressTotal: 'settings.notion.fields.progressTotal',
  progressUnit: 'settings.notion.fields.progressUnit',
  rating: 'settings.notion.fields.rating',
  review: 'settings.notion.fields.review',
  shortReview: 'settings.notion.fields.shortReview',
  startedAt: 'settings.notion.fields.startedAt',
  status: 'settings.notion.fields.status',
};

function formatCount(value: number) {
  return formatAppNumber(value);
}

function formatValue(value: unknown, t: TranslationFn) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : t('settings.notion.emptyValue');
  }

  if (typeof value === 'boolean') {
    return value ? t('settings.notion.yes') : t('settings.notion.no');
  }

  if (value === null || value === undefined || value === '') {
    return t('settings.notion.emptyValue');
  }

  return String(value);
}

function PreviewChangeCard({ change }: { change: NotionChangePreview }) {
  const { t } = useAppTranslation();

  return (
    <Box className={css.providerInfoCard ?? ''}>
      <Stack gap="xs">
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Text className={css.providerInfoTitle ?? ''}>{change.title}</Text>
          <AppBadge tone="info">
            {t('settings.notion.changeCount', {
              count: formatCount(change.changes.length),
            })}
          </AppBadge>
        </Group>
        <Stack gap={4}>
          {change.changes.slice(0, 4).map((entry) => {
            const fieldLabelKey = fieldLabelKeys[entry.field];

            return (
              <Text className={css.providerInfoMeta ?? ''} key={entry.field}>
                {t('settings.notion.changeLine', {
                  field: fieldLabelKey ? t(fieldLabelKey) : entry.field,
                  localValue: formatValue(entry.localValue, t),
                  notionValue: formatValue(entry.notionValue, t),
                })}
              </Text>
            );
          })}
          {change.changes.length > 4 && (
            <Text className={css.providerInfoMeta ?? ''}>
              {t('settings.notion.moreFields', {
                count: formatCount(change.changes.length - 4),
              })}
            </Text>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export function NotionSyncSettingsSection({
  connectionDraft,
  feedback,
  isApplyingPull,
  isDeletingConnection,
  isLoadingStatus,
  isPreviewingPull,
  isPushing,
  isSavingConnection,
  isTestingConnection,
  mode,
  onApplyPull,
  onDeleteConnection,
  onPreviewPull,
  onPushToNotion,
  onSaveConnection,
  onTestConnection,
  onUpdateConnectionDraft,
  pullPreview,
  status,
}: NotionSyncSettingsSectionProps) {
  const { t } = useAppTranslation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveConnection();
  }

  const configured = Boolean(status?.configured);
  const lastSyncedAt = status?.lastSyncedAt
    ? formatAppDateTime(new Date(status.lastSyncedAt), {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('settings.notion.noSyncRecord');

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.notion.description')}
        eyebrow={t('settings.notion.eyebrow')}
        title={t('settings.notion.title')}
      />

      {mode !== 'authenticated' ? (
        <Text c="dimmed">
          {t('settings.notion.guestDescription')}
        </Text>
      ) : isLoadingStatus ? (
        <Text aria-busy="true" c="dimmed">
          {t('settings.notion.loadingStatus')}
        </Text>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  {t('settings.notion.connectionStatus')}
                </Text>
                <Group gap="xs">
                  <Text fw={900}>
                    {configured
                      ? t('settings.notion.connected')
                      : t('settings.notion.disconnected')}
                  </Text>
                  <AppBadge tone={configured ? 'success' : 'warning'}>
                    Notion
                  </AppBadge>
                </Group>
              </Stack>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  {t('settings.notion.mappedWorks')}
                </Text>
                <Text fw={900}>{formatCount(status?.mappedCount ?? 0)}</Text>
              </Stack>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  {t('settings.notion.lastSync')}
                </Text>
                <Text fw={900} size="sm">
                  {lastSyncedAt}
                </Text>
              </Stack>
            </SectionCard>
          </SimpleGrid>

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                data-1p-ignore="true"
                data-lpignore="true"
                description={t('settings.notion.dataSourceDescription')}
                label="Notion data source ID"
                onChange={(event) =>
                  onUpdateConnectionDraft(
                    'dataSourceId',
                    event.currentTarget.value,
                  )
                }
                placeholder={t('settings.notion.dataSourcePlaceholder')}
                spellCheck={false}
                value={connectionDraft.dataSourceId}
              />
              <PasswordInput
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                description={t('settings.notion.tokenDescription')}
                label="Notion token"
                onChange={(event) =>
                  onUpdateConnectionDraft('token', event.currentTarget.value)
                }
                placeholder="secret_..."
                value={connectionDraft.token}
              />
              <ActionRow>
                <AppButton
                  disabled={isDeletingConnection}
                  loading={isSavingConnection}
                  tone="primary"
                  type="submit"
                >
                  {t('settings.notion.saveConnection')}
                </AppButton>
                <AppButton
                  disabled={!configured || isSavingConnection}
                  loading={isTestingConnection}
                  onClick={() => void onTestConnection()}
                  tone="secondary"
                  type="button"
                >
                  {t('settings.notion.testConnection')}
                </AppButton>
                <AppButton
                  disabled={!configured || isSavingConnection}
                  loading={isDeletingConnection}
                  onClick={() => void onDeleteConnection()}
                  tone="danger"
                  type="button"
                >
                  {t('settings.notion.deleteConnection')}
                </AppButton>
              </ActionRow>
            </Stack>
          </form>

          <Divider />

          <SectionCard padding="md" tone="subtle">
            <Stack gap="md">
              <SectionIntro
                description={t('settings.notion.manualSyncDescription')}
                eyebrow={t('settings.notion.manualSyncEyebrow')}
                title="Push / Pull"
                titleOrder={3}
              />
              <ActionRow>
                <AppButton
                  disabled={!configured || isPreviewingPull || isApplyingPull}
                  loading={isPushing}
                  onClick={() => void onPushToNotion()}
                  tone="primary"
                  type="button"
                >
                  Work Archive → Notion
                </AppButton>
                <AppButton
                  disabled={!configured || isPushing || isApplyingPull}
                  loading={isPreviewingPull}
                  onClick={() => void onPreviewPull()}
                  tone="secondary"
                  type="button"
                >
                  {t('settings.notion.previewPull')}
                </AppButton>
                <AppButton
                  disabled={!pullPreview || pullPreview.total === 0 || isPushing}
                  loading={isApplyingPull}
                  onClick={() => void onApplyPull()}
                  tone="secondary"
                  type="button"
                >
                  {t('settings.notion.applyPreview')}
                </AppButton>
              </ActionRow>
            </Stack>
          </SectionCard>

          {pullPreview && pullPreview.changes.length > 0 && (
            <Stack gap="sm">
              <Group gap="xs" justify="space-between">
                <Text fw={850}>{t('settings.notion.previewTitle')}</Text>
                <AppBadge tone="info">
                  {t('settings.notion.itemCount', {
                    count: formatCount(pullPreview.total),
                  })}
                </AppBadge>
              </Group>
              <div className={css.publicProviderGrid ?? ''}>
                {pullPreview.changes.slice(0, 6).map((change) => (
                  <PreviewChangeCard change={change} key={change.workId} />
                ))}
              </div>
            </Stack>
          )}

          {feedback && (
            <FeedbackMessage tone={feedback.tone}>
              {feedback.message}
            </FeedbackMessage>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}
