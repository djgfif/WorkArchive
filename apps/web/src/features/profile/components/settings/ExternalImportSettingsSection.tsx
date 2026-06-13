import { Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { formatAppNumber, useAppTranslation } from '@app/i18n';
import {
  externalRecordsImportService,
  type ExternalImportPreview,
} from '@features/archive';
import {
  createCsvImportTemplate,
  enrichMalEntriesWithAniList,
  fetchAniListUserEntries,
  parseMyAnimeListExportXml,
  parseRecordsCsv,
  type ExternalImportEntry,
} from '@features/imports';
import { getWorkStatusLabel, getWorkTypeLabel } from '@features/works';
import type { WorkStatus, WorkType } from '@work-archive/shared-types';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

const css = styles;

function formatCount(value: number) {
  return formatAppNumber(value);
}

interface LoadedExternalImport {
  entries: ExternalImportEntry[];
  preview: ExternalImportPreview;
  sourceDescription: string;
}

function formatCountEntries(
  counts: Partial<Record<string, number>>,
  formatLabel: (value: string) => string,
  formatCountLabel: (label: string, count: number) => string,
) {
  return Object.entries(counts)
    .filter((pair): pair is [string, number] => Boolean(pair[1]))
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => formatCountLabel(formatLabel(value), count));
}

export function ExternalImportSettingsSection() {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [aniListUserName, setAniListUserName] = useState('');
  const [loaded, setLoaded] = useState<LoadedExternalImport | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);

  async function loadEntries(
    entriesPromise: Promise<ExternalImportEntry[]> | ExternalImportEntry[],
    sourceDescription: string,
  ) {
    setFeedback(null);
    setIsLoading(true);

    try {
      const entries = await entriesPromise;

      if (entries.length === 0) {
        setLoaded(null);
        setFeedback({
          message: t('settings.externalImport.emptySource', {
            source: sourceDescription,
          }),
          tone: 'info',
        });
        return;
      }

      const preview =
        await externalRecordsImportService.previewEntries(entries);

      setLoaded({ entries, preview, sourceDescription });
    } catch (error) {
      setLoaded(null);
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : t('settings.externalImport.loadError'),
        tone: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMalFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    const xmlText = await file.text();

    // MAL 내보내기에는 표지가 없으므로 AniList 매칭으로 표지·작가를 채운다.
    await loadEntries(
      Promise.resolve()
        .then(() => parseMyAnimeListExportXml(xmlText))
        .then(async (entries) => {
          const enriched = await enrichMalEntriesWithAniList(entries);

          return enriched.entries;
        }),
      t('settings.externalImport.mal.sourceDescription', { fileName: file.name }),
    );
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    const csvText = await file.text();

    await loadEntries(
      Promise.resolve().then(() => parseRecordsCsv(csvText)),
      t('settings.externalImport.csv.sourceDescription', { fileName: file.name }),
    );
  }

  function handleDownloadCsvTemplate() {
    // BOM을 붙여야 Excel이 UTF-8 한글을 올바르게 연다.
    const blob = new Blob([String.fromCharCode(0xfeff), createCsvImportTemplate()], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'work-archive-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!loaded) {
      return;
    }

    setIsImporting(true);
    setFeedback(null);

    try {
      const result = await externalRecordsImportService.importEntries(
        loaded.entries,
        { skipDuplicates },
      );

      setLoaded(null);
      setFeedback({
        message:
          result.skippedDuplicateCount > 0
            ? t('settings.externalImport.importSuccessWithSkipped', {
                importedCount: formatCount(result.importedCount),
                skippedCount: formatCount(result.skippedDuplicateCount),
              })
            : t('settings.externalImport.importSuccess', {
                count: formatCount(result.importedCount),
              }),
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : t('settings.externalImport.importError'),
        tone: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  }

  const previewTypeBadges = loaded
    ? formatCountEntries(loaded.preview.typeCounts, (value) =>
        getWorkTypeLabel(value as WorkType),
        (label, count) =>
          t('settings.externalImport.countLabel', {
            count: formatCount(count),
            label,
          }),
      )
    : [];
  const previewStatusBadges = loaded
    ? formatCountEntries(loaded.preview.statusCounts, (value) =>
        getWorkStatusLabel(value as WorkStatus),
        (label, count) =>
          t('settings.externalImport.countLabel', {
            count: formatCount(count),
            label,
          }),
      )
    : [];
  const importCount = loaded
    ? skipDuplicates
      ? loaded.preview.newCount
      : loaded.preview.totalCount
    : 0;

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.externalImport.description')}
        eyebrow={t('settings.externalImport.eyebrow')}
        title={t('settings.externalImport.title')}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.externalImport.aniList.description')}
            eyebrow="AniList"
            title={t('settings.externalImport.aniList.title')}
            titleOrder={3}
          />
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label={t('settings.externalImport.aniList.userName')}
              onChange={(event) => setAniListUserName(event.currentTarget.value)}
              placeholder={t('settings.externalImport.aniList.placeholder')}
              style={{ flex: 1, minWidth: '12rem' }}
              value={aniListUserName}
            />
            <AppButton
              disabled={isLoading || !aniListUserName.trim()}
              loading={isLoading}
              onClick={() =>
                void loadEntries(
                  fetchAniListUserEntries(aniListUserName),
                  `AniList @${aniListUserName.trim()}`,
                )
              }
              tone="primary"
              type="button"
            >
              {t('settings.externalImport.preview')}
            </AppButton>
          </Group>
          <ActionRow>
            <AppBadge tone="muted">
              {t('settings.externalImport.badgeCovers')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.badgeRatingProgress')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.aniList.badgePublicOnly')}
            </AppBadge>
          </ActionRow>
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.externalImport.mal.description')}
            eyebrow="MyAnimeList"
            title={t('settings.externalImport.mal.title')}
            titleOrder={3}
          />
          <AppButton
            disabled={isLoading}
            loading={isLoading}
            onClick={() => fileInputRef.current?.click()}
            tone="secondary"
            type="button"
          >
            {t('settings.externalImport.mal.selectFile')}
          </AppButton>
          <input
            accept=".xml,text/xml,application/xml"
            aria-label={t('settings.externalImport.mal.selectFileAria')}
            className={css.visuallyHiddenInput ?? ''}
            onChange={(event) => void handleMalFileChange(event)}
            ref={fileInputRef}
            type="file"
          />
          <ActionRow>
            <AppBadge tone="muted">
              {t('settings.externalImport.mal.badgeAnimeManga')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.badgeRatingProgress')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.mal.badgeCoverMatching')}
            </AppBadge>
          </ActionRow>
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.externalImport.csv.description')}
            eyebrow="CSV"
            title={t('settings.externalImport.csv.title')}
            titleOrder={3}
          />
          <ActionRow>
            <AppButton
              disabled={isLoading}
              onClick={() => csvFileInputRef.current?.click()}
              tone="secondary"
              type="button"
            >
              {t('settings.externalImport.csv.selectFile')}
            </AppButton>
            <AppButton
              onClick={handleDownloadCsvTemplate}
              tone="quiet"
              type="button"
            >
              {t('settings.externalImport.csv.downloadTemplate')}
            </AppButton>
          </ActionRow>
          <input
            accept=".csv,text/csv"
            aria-label={t('settings.externalImport.csv.selectFileAria')}
            className={css.visuallyHiddenInput ?? ''}
            onChange={(event) => void handleCsvFileChange(event)}
            ref={csvFileInputRef}
            type="file"
          />
          <ActionRow>
            <AppBadge tone="muted">
              {t('settings.externalImport.csv.badgeKoEnHeaders')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.csv.badgeTagsReviews')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.csv.badgeReimport')}
            </AppBadge>
          </ActionRow>
        </SectionCard>
      </SimpleGrid>

      {loaded && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={t('settings.externalImport.previewDescription', {
              count: formatCount(loaded.preview.totalCount),
              source: loaded.sourceDescription,
            })}
            eyebrow={t('settings.externalImport.previewEyebrow')}
            title={t('settings.externalImport.previewTitle')}
            titleOrder={3}
          />
          <ActionRow>
            <AppBadge tone="accent">
              {t('settings.externalImport.previewNewWorks', {
                count: formatCount(loaded.preview.newCount),
              })}
            </AppBadge>
            <AppBadge tone={loaded.preview.duplicateCount > 0 ? 'warning' : 'muted'}>
              {t('settings.externalImport.previewDuplicates', {
                count: formatCount(loaded.preview.duplicateCount),
              })}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.externalImport.previewWithCovers', {
                count: formatCount(loaded.preview.withCoverCount),
              })}
            </AppBadge>
          </ActionRow>
          {previewTypeBadges.length > 0 && (
            <ActionRow>
              {previewTypeBadges.map((badge) => (
                <AppBadge key={badge} tone="muted">
                  {badge}
                </AppBadge>
              ))}
            </ActionRow>
          )}
          {previewStatusBadges.length > 0 && (
            <ActionRow>
              {previewStatusBadges.map((badge) => (
                <AppBadge key={badge} tone="muted">
                  {badge}
                </AppBadge>
              ))}
            </ActionRow>
          )}
          <Checkbox
            checked={skipDuplicates}
            label={t('settings.externalImport.skipDuplicates')}
            onChange={(event) => setSkipDuplicates(event.currentTarget.checked)}
          />
          <ActionRow>
            <AppButton
              disabled={isImporting || importCount === 0}
              loading={isImporting}
              onClick={() => void handleImport()}
              tone="primary"
              type="button"
            >
              {t('settings.externalImport.importCount', {
                count: formatCount(importCount),
              })}
            </AppButton>
            <AppButton
              disabled={isImporting}
              onClick={() => {
                setLoaded(null);
                setFeedback(null);
              }}
              tone="quiet"
              type="button"
            >
              {t('common.cancel')}
            </AppButton>
          </ActionRow>
        </SectionCard>
      )}

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          {feedback.message}
        </FeedbackMessage>
      )}

      <Stack gap={4}>
        <Text c="dimmed" size="sm">
          {t('settings.externalImport.footer')}
        </Text>
      </Stack>
    </SectionCard>
  );
}
