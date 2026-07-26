import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ChangeEvent, DragEvent } from 'react';
import { useRef } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
} from '@app/i18n';
import type { LocalArchiveImportPreview } from '@features/archive';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

const css = styles;

function formatCount(value: number) {
  return formatAppNumber(value);
}

type TranslationFn = ReturnType<typeof useAppTranslation>['t'];

function formatDateTime(value: string) {
  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getSourceScopeLabel(
  preview: LocalArchiveImportPreview,
  t: TranslationFn,
) {
  return preview.sourceScope === 'full'
    ? t('settings.dataBackup.previewSourceScopeFull')
    : t('settings.dataBackup.previewSourceScopeSimple');
}

interface ExportOptionCardProps {
  buttonLabel: string;
  description: string;
  details: string[];
  disabled: boolean;
  eyebrow: string;
  onClick: () => void;
  summary: string;
  title: string;
  tone: 'primary' | 'secondary';
}

interface DataBackupSettingsSectionProps {
  archiveFeedback: SettingsFeedback | null;
  archiveImportPreview: LocalArchiveImportPreview | null;
  isExportingArchive: boolean;
  isImportingArchive: boolean;
  onCancelImport: () => void;
  onConfirmImport: () => void;
  onExportCsv: () => void;
  onExportFullJson: () => void;
  onExportJson: () => void;
  onImportFileSelect: (file: File) => Promise<void>;
}

function ExportOptionCard({
  buttonLabel,
  description,
  details,
  disabled,
  eyebrow,
  onClick,
  summary,
  title,
  tone,
}: ExportOptionCardProps) {
  return (
    <SectionCard padding="lg" tone="subtle">
      <SectionIntro
        description={description}
        eyebrow={eyebrow}
        title={title}
        titleOrder={3}
      />
      <Stack gap="xs">
        <Text fw={800} size="sm">
          {summary}
        </Text>
        <ActionRow>
          {details.map((detail) => (
            <AppBadge key={detail} tone="muted">
              {detail}
            </AppBadge>
          ))}
        </ActionRow>
      </Stack>
      <AppButton
        disabled={disabled}
        onClick={onClick}
        tone={tone}
        type="button"
      >
        {buttonLabel}
      </AppButton>
    </SectionCard>
  );
}

export function DataBackupSettingsSection({
  archiveFeedback,
  archiveImportPreview,
  isExportingArchive,
  isImportingArchive,
  onCancelImport,
  onConfirmImport,
  onExportCsv,
  onExportFullJson,
  onExportJson,
  onImportFileSelect,
}: DataBackupSettingsSectionProps) {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImportFile(file: File | null) {
    if (!file) {
      return;
    }

    await onImportFileSelect(file);
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    try {
      await handleImportFile(file);
    } finally {
      input.value = '';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleImportFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.dataBackup.description')}
        eyebrow={t('settings.dataBackup.eyebrow')}
        title={t('settings.dataBackup.title')}
      />

      <div className={css.backupPrimaryActions ?? ''}>
        <AppButton
          disabled={isExportingArchive}
          onClick={() => void onExportJson()}
          tone="primary"
          type="button"
        >
          {t('settings.dataBackup.backupNow')}
        </AppButton>
        <AppButton
          disabled={isImportingArchive}
          onClick={() => fileInputRef.current?.click()}
          tone="secondary"
          type="button"
        >
          {t('settings.dataBackup.restoreBackup')}
        </AppButton>
        <input
          accept="application/json,.json"
          aria-label={t('settings.dataBackup.selectJsonAria')}
          className={css.visuallyHiddenInput ?? ''}
          onChange={(event) => void handleImportFileChange(event)}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <details className={css.backupOptions ?? ''}>
        <summary>{t('settings.dataBackup.optionsTitle')}</summary>
        <Stack gap="md" mt="md">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <ExportOptionCard
              buttonLabel={t('settings.dataBackup.json.button')}
              description={t('settings.dataBackup.json.description')}
              details={[
                t('settings.dataBackup.details.works'),
                t('settings.dataBackup.details.releaseRecords'),
                t('settings.dataBackup.details.timeline'),
              ]}
              disabled={isExportingArchive}
              eyebrow={t('settings.dataBackup.json.eyebrow')}
              onClick={() => void onExportJson()}
              summary={t('settings.dataBackup.json.summary')}
              title={t('settings.dataBackup.json.title')}
              tone="primary"
            />

            <ExportOptionCard
              buttonLabel={t('settings.dataBackup.fullJson.button')}
              description={t('settings.dataBackup.fullJson.description')}
              details={[
                t('settings.dataBackup.details.metadata'),
                t('settings.dataBackup.details.relationGraph'),
                t('settings.dataBackup.details.tierBoards'),
              ]}
              disabled={isExportingArchive}
              eyebrow={t('settings.dataBackup.fullJson.eyebrow')}
              onClick={() => void onExportFullJson()}
              summary={t('settings.dataBackup.fullJson.summary')}
              title={t('settings.dataBackup.fullJson.title')}
              tone="secondary"
            />

            <ExportOptionCard
              buttonLabel={t('settings.dataBackup.csv.button')}
              description={t('settings.dataBackup.csv.description')}
              details={[
                t('settings.dataBackup.details.listReview'),
                t('settings.dataBackup.details.spreadsheet'),
                t('settings.dataBackup.details.reimportable'),
              ]}
              disabled={isExportingArchive}
              eyebrow={t('settings.dataBackup.csv.eyebrow')}
              onClick={() => void onExportCsv()}
              summary={t('settings.dataBackup.csv.summary')}
              title={t('settings.dataBackup.csv.title')}
              tone="secondary"
            />
          </SimpleGrid>

          <div
            className={css.fileDropzone ?? ''}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <Stack gap="xs">
              <Text fw={800}>{t('settings.dataBackup.importTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('settings.dataBackup.importDescription')}
              </Text>
              <ActionRow>
                <AppBadge tone="muted">
                  {t('settings.dataBackup.badgeKeepExisting')}
                </AppBadge>
                <AppBadge tone="muted">
                  {t('settings.dataBackup.badgeDuplicatePreview')}
                </AppBadge>
                <AppBadge tone="muted">
                  {t('settings.dataBackup.badgeExcludeApiKey')}
                </AppBadge>
              </ActionRow>
            </Stack>
            <AppButton
              onClick={() => fileInputRef.current?.click()}
              tone="secondary"
              type="button"
            >
              {t('settings.dataBackup.selectJson')}
            </AppButton>
          </div>
        </Stack>
      </details>

      {archiveImportPreview && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.dataBackup.previewDescription')}
            eyebrow={t('settings.dataBackup.previewEyebrow')}
            title={t('settings.dataBackup.previewTitle')}
            titleOrder={3}
          />
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: t('settings.dataBackup.previewSourceScope'),
                value: getSourceScopeLabel(archiveImportPreview, t),
              },
              {
                label: t('settings.dataBackup.previewSourceExportedAt'),
                value: formatDateTime(archiveImportPreview.sourceExportedAt),
              },
              {
                label: t('settings.dataBackup.previewSourceSchema'),
                value: t('settings.dataBackup.previewSourceSchemaVersion', {
                  version: archiveImportPreview.sourceSchemaVersion,
                }),
              },
              {
                label: t('settings.dataBackup.previewSourceRecords'),
                value: t('settings.dataBackup.previewSourceRecordCounts', {
                  releaseRecordCount: formatCount(
                    archiveImportPreview.sourceRecordCounts.releaseRecordCount,
                  ),
                  timelineEntryCount: formatCount(
                    archiveImportPreview.sourceRecordCounts.timelineEntryCount,
                  ),
                  workCount: formatCount(
                    archiveImportPreview.sourceRecordCounts.workCount,
                  ),
                }),
              },
            ]}
          />
          <ActionRow>
            <AppBadge tone="accent">
              {t('settings.dataBackup.previewAddWorks', {
                count: formatCount(archiveImportPreview.addWorkCount),
              })}
            </AppBadge>
            <AppBadge tone="accent">
              {t('settings.dataBackup.previewAddReleaseRecords', {
                count: formatCount(archiveImportPreview.addReleaseRecordCount),
              })}
            </AppBadge>
            <AppBadge tone="accent">
              {t('settings.dataBackup.previewAddTimeline', {
                count: formatCount(archiveImportPreview.addTimelineEntryCount),
              })}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.dataBackup.previewUpdateWorks', {
                count: formatCount(archiveImportPreview.updateWorkCount),
              })}
            </AppBadge>
            <AppBadge tone="warning">
              {t('settings.dataBackup.previewDuplicates', {
                count: formatCount(
                  archiveImportPreview.duplicateWorkCount +
                    archiveImportPreview.duplicateTimelineEntryCount,
                ),
              })}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.dataBackup.previewConflicts', {
                count: formatCount(archiveImportPreview.conflictWorkCount),
              })}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.dataBackup.previewSkipped', {
                count: formatCount(
                  archiveImportPreview.skippedWorkCount +
                    archiveImportPreview.skippedReleaseRecordCount +
                    archiveImportPreview.skippedTimelineEntryCount +
                    archiveImportPreview.skippedSeriesCount +
                    archiveImportPreview.skippedContributorCount +
                    archiveImportPreview.skippedWorkSeriesLinkCount +
                    archiveImportPreview.skippedWorkContributorCount +
                    archiveImportPreview.skippedWorkRelationCount +
                    archiveImportPreview.skippedTierBoardCount +
                    archiveImportPreview.skippedTierLaneCount +
                    archiveImportPreview.skippedTierBoardCardCount +
                    archiveImportPreview.skippedTierBoardAssetCount,
                ),
              })}
            </AppBadge>
          </ActionRow>
          {(archiveImportPreview.addSeriesCount > 0 ||
            archiveImportPreview.addContributorCount > 0 ||
            archiveImportPreview.addTierBoardCount > 0) && (
            <ActionRow>
              <AppBadge tone="accent">
                {t('settings.dataBackup.previewAddGraph', {
                  count: formatCount(
                    archiveImportPreview.addSeriesCount +
                      archiveImportPreview.addContributorCount +
                      archiveImportPreview.addWorkSeriesLinkCount +
                      archiveImportPreview.addWorkContributorCount +
                      archiveImportPreview.addWorkRelationCount,
                  ),
                })}
              </AppBadge>
              <AppBadge tone="accent">
                {t('settings.dataBackup.previewAddTierBoards', {
                  count: formatCount(
                    archiveImportPreview.addTierBoardCount +
                      archiveImportPreview.addTierLaneCount +
                      archiveImportPreview.addTierBoardCardCount +
                      archiveImportPreview.addTierBoardAssetCount,
                  ),
                })}
              </AppBadge>
            </ActionRow>
          )}
          <ActionRow>
            <AppButton
              disabled={isImportingArchive}
              loading={isImportingArchive}
              onClick={() => void onConfirmImport()}
              tone="primary"
              type="button"
            >
              {t('settings.dataBackup.confirmImport')}
            </AppButton>
            <AppButton
              disabled={isImportingArchive}
              onClick={onCancelImport}
              tone="quiet"
              type="button"
            >
              {t('common.cancel')}
            </AppButton>
          </ActionRow>
        </SectionCard>
      )}

      {archiveFeedback && (
        <FeedbackMessage tone={archiveFeedback.tone}>
          {archiveFeedback.message}
        </FeedbackMessage>
      )}

      <Group gap="xs">
        <AppBadge tone="muted">
          {t('settings.dataBackup.badgeWorkRecords')}
        </AppBadge>
        <AppBadge tone="muted">
          {t('settings.dataBackup.badgeExcludeLogin')}
        </AppBadge>
        <AppBadge tone="muted">
          {t('settings.dataBackup.badgeExcludeSearchKey')}
        </AppBadge>
      </Group>
    </SectionCard>
  );
}
