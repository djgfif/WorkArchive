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

interface LoadedExternalImport {
  entries: ExternalImportEntry[];
  preview: ExternalImportPreview;
  sourceDescription: string;
}

function formatCountEntries(
  counts: Partial<Record<string, number>>,
  formatLabel: (value: string) => string,
) {
  return Object.entries(counts)
    .filter((pair): pair is [string, number] => Boolean(pair[1]))
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => `${formatLabel(value)} ${count}개`);
}

export function ExternalImportSettingsSection() {
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
          message: `${sourceDescription}에서 가져올 기록을 찾지 못했습니다.`,
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
            : '외부 기록을 불러오지 못했습니다.',
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
      `MyAnimeList 파일(${file.name})`,
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
      `CSV 파일(${file.name})`,
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
            ? `${result.importedCount}개 작품을 가져왔고, 이미 있는 ${result.skippedDuplicateCount}개는 건너뛰었습니다.`
            : `${result.importedCount}개 작품을 가져왔습니다.`,
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '외부 기록 가져오기에 실패했습니다.',
        tone: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  }

  const previewTypeBadges = loaded
    ? formatCountEntries(loaded.preview.typeCounts, (value) =>
        getWorkTypeLabel(value as WorkType),
      )
    : [];
  const previewStatusBadges = loaded
    ? formatCountEntries(loaded.preview.statusCounts, (value) =>
        getWorkStatusLabel(value as WorkStatus),
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
        description="다른 서비스에 쌓아 둔 감상 기록을 한 번에 옮겨 옵니다. 기존 기록은 지워지지 않고, 같은 제목·유형의 작품은 건너뛸 수 있습니다."
        eyebrow="외부 기록 가져오기"
        title="다른 서비스에서 옮겨오기"
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="공개 설정된 AniList 리스트를 사용자명만으로 가져옵니다. 표지와 별점, 진행도까지 함께 옮겨집니다."
            eyebrow="AniList"
            title="AniList 사용자명으로 가져오기"
            titleOrder={3}
          />
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label="AniList 사용자명"
              onChange={(event) => setAniListUserName(event.currentTarget.value)}
              placeholder="예: AniListUser123"
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
              미리보기
            </AppButton>
          </Group>
          <ActionRow>
            <AppBadge tone="muted">표지 포함</AppBadge>
            <AppBadge tone="muted">별점·진행도 포함</AppBadge>
            <AppBadge tone="muted">공개 리스트만</AppBadge>
          </ActionRow>
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="MyAnimeList의 목록 내보내기(.xml) 파일을 선택하세요. 표지와 작가는 AniList 매칭으로 자동으로 채웁니다."
            eyebrow="MyAnimeList"
            title="MAL 내보내기 파일로 가져오기"
            titleOrder={3}
          />
          <AppButton
            disabled={isLoading}
            loading={isLoading}
            onClick={() => fileInputRef.current?.click()}
            tone="secondary"
            type="button"
          >
            MAL XML 파일 선택
          </AppButton>
          <input
            accept=".xml,text/xml,application/xml"
            aria-label="MyAnimeList 내보내기 XML 파일 선택"
            className={css.visuallyHiddenInput ?? ''}
            onChange={(event) => void handleMalFileChange(event)}
            ref={fileInputRef}
            type="file"
          />
          <ActionRow>
            <AppBadge tone="muted">애니·만화 목록</AppBadge>
            <AppBadge tone="muted">별점·진행도 포함</AppBadge>
            <AppBadge tone="muted">표지 자동 매칭</AppBadge>
          </ActionRow>
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="스프레드시트로 정리한 목록을 가져옵니다. 첫 줄 헤더의 제목·유형·상태·별점 열을 자동으로 인식하고, 이 앱의 CSV 내보내기 파일도 그대로 읽습니다."
            eyebrow="CSV"
            title="CSV 파일로 가져오기"
            titleOrder={3}
          />
          <ActionRow>
            <AppButton
              disabled={isLoading}
              onClick={() => csvFileInputRef.current?.click()}
              tone="secondary"
              type="button"
            >
              CSV 파일 선택
            </AppButton>
            <AppButton
              onClick={handleDownloadCsvTemplate}
              tone="quiet"
              type="button"
            >
              빈 양식 내려받기
            </AppButton>
          </ActionRow>
          <input
            accept=".csv,text/csv"
            aria-label="CSV 파일 선택"
            className={css.visuallyHiddenInput ?? ''}
            onChange={(event) => void handleCsvFileChange(event)}
            ref={csvFileInputRef}
            type="file"
          />
          <ActionRow>
            <AppBadge tone="muted">한국어·영어 헤더</AppBadge>
            <AppBadge tone="muted">태그·한줄평 포함</AppBadge>
            <AppBadge tone="muted">내보내기 재가져오기</AppBadge>
          </ActionRow>
        </SectionCard>
      </SimpleGrid>

      {loaded && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description={`${loaded.sourceDescription}에서 ${loaded.preview.totalCount}개 기록을 찾았습니다.`}
            eyebrow="가져오기 미리보기"
            title="가져올 기록 확인"
            titleOrder={3}
          />
          <ActionRow>
            <AppBadge tone="accent">
              새 작품 {loaded.preview.newCount}개
            </AppBadge>
            <AppBadge tone={loaded.preview.duplicateCount > 0 ? 'warning' : 'muted'}>
              이미 있는 제목 {loaded.preview.duplicateCount}개
            </AppBadge>
            <AppBadge tone="muted">
              표지 포함 {loaded.preview.withCoverCount}개
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
            label="이미 있는 제목은 건너뛰기"
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
              {importCount}개 가져오기
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
              취소
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
          가져온 작품은 이 기기에 먼저 저장되고, 로그인 상태라면 서버 백업
          대기열에도 함께 올라갑니다.
        </Text>
      </Stack>
    </SectionCard>
  );
}
