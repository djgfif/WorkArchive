import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ChangeEvent, DragEvent } from 'react';
import { useRef } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '../../../../shared/components/AppPrimitives';
import type { LocalArchiveImportPreview } from '../../../archive';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

const css = styles as Record<string, string>;

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImportFile(file: File | null) {
    if (!file) {
      return;
    }

    await onImportFileSelect(file);
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    try {
      await handleImportFile(file);
    } finally {
      event.currentTarget.value = '';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleImportFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <SectionCard>
      <SectionIntro
        description="현재 브라우저의 로컬 아카이브를 파일로 보관하고, 이전 JSON 백업을 기존 기록 위에 안전하게 병합합니다."
        eyebrow="데이터와 백업"
        title="로컬 백업과 복구"
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <ExportOptionCard
          buttonLabel="JSON 백업 내보내기"
          description="가져오기로 복구할 때 가장 기본이 되는 보관용 파일입니다."
          details={['작품', '권별 기록', '타임라인']}
          disabled={isExportingArchive}
          eyebrow="복구 가능"
          onClick={() => void onExportJson()}
          summary="작품 기록 중심 백업"
          title="JSON 백업"
          tone="primary"
        />

        <ExportOptionCard
          buttonLabel="전체 JSON 내보내기"
          description="시리즈, 제작진, 관계 그래프, 티어보드까지 포함합니다. 로컬 업로드 이미지 원본은 제외될 수 있습니다."
          details={['메타데이터 중심', '관계 그래프', '티어보드']}
          disabled={isExportingArchive}
          eyebrow="전체 복구"
          onClick={() => void onExportFullJson()}
          summary="아카이브 구조까지 보관"
          title="전체 백업"
          tone="secondary"
        />

        <ExportOptionCard
          buttonLabel="CSV 내보내기"
          description="스프레드시트에서 목록을 확인하기 위한 파일입니다. 다시 가져오기용 형식은 아닙니다."
          details={['목록 확인', '스프레드시트', '가져오기 불가']}
          disabled={isExportingArchive}
          eyebrow="검토용"
          onClick={() => void onExportCsv()}
          summary="사람이 읽기 쉬운 목록"
          title="CSV 내보내기"
          tone="secondary"
        />
      </SimpleGrid>

      <div
        className={css.fileDropzone ?? ''}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <Stack gap="xs">
          <Text fw={800}>JSON 백업 가져오기</Text>
          <Text c="dimmed" size="sm">
            백업 파일을 여기에 놓거나 파일 선택 버튼을 사용하세요. API key와
            로그인 세션 정보는 백업 파일에 포함되지 않습니다.
          </Text>
          <ActionRow>
            <AppBadge tone="muted">기존 기록 유지</AppBadge>
            <AppBadge tone="muted">중복 미리보기</AppBadge>
            <AppBadge tone="muted">API key 제외</AppBadge>
          </ActionRow>
        </Stack>
        <AppButton
          onClick={() => fileInputRef.current?.click()}
          tone="secondary"
          type="button"
        >
          JSON 백업 선택
        </AppButton>
        <input
          accept="application/json,.json"
          aria-label="JSON 백업 파일 선택"
          className={css.visuallyHiddenInput ?? ''}
          onChange={(event) => void handleImportFileChange(event)}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {archiveImportPreview && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="기존 기록은 보존하고, 제목이 비슷한 후보를 미리 보여준 뒤 새 기록으로 추가합니다."
            eyebrow="가져오기 미리보기"
            title="가져올 기록 확인"
            titleOrder={3}
          />
          <ActionRow>
            <AppBadge tone="accent">
              추가 작품 {archiveImportPreview.addWorkCount}개
            </AppBadge>
            <AppBadge tone="accent">
              추가 권별 기록 {archiveImportPreview.addReleaseRecordCount}개
            </AppBadge>
            <AppBadge tone="accent">
              추가 타임라인 {archiveImportPreview.addTimelineEntryCount}개
            </AppBadge>
            <AppBadge tone="muted">
              수정 작품 {archiveImportPreview.updateWorkCount}개
            </AppBadge>
            <AppBadge tone="warning">
              중복 후보{' '}
              {archiveImportPreview.duplicateWorkCount +
                archiveImportPreview.duplicateTimelineEntryCount}
              개
            </AppBadge>
            <AppBadge tone="muted">
              직접 확인 {archiveImportPreview.conflictWorkCount}개
            </AppBadge>
            <AppBadge tone="muted">
              건너뜀{' '}
              {archiveImportPreview.skippedWorkCount +
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
                archiveImportPreview.skippedTierBoardAssetCount}
              개
            </AppBadge>
          </ActionRow>
          {(archiveImportPreview.addSeriesCount > 0 ||
            archiveImportPreview.addContributorCount > 0 ||
            archiveImportPreview.addTierBoardCount > 0) && (
            <ActionRow>
              <AppBadge tone="accent">
                추가 그래프{' '}
                {archiveImportPreview.addSeriesCount +
                  archiveImportPreview.addContributorCount +
                  archiveImportPreview.addWorkSeriesLinkCount +
                  archiveImportPreview.addWorkContributorCount +
                  archiveImportPreview.addWorkRelationCount}
                개
              </AppBadge>
              <AppBadge tone="accent">
                추가 티어보드{' '}
                {archiveImportPreview.addTierBoardCount +
                  archiveImportPreview.addTierLaneCount +
                  archiveImportPreview.addTierBoardCardCount +
                  archiveImportPreview.addTierBoardAssetCount}
                개
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
              현재 아카이브로 가져오기
            </AppButton>
            <AppButton
              disabled={isImportingArchive}
              onClick={onCancelImport}
              tone="quiet"
              type="button"
            >
              취소
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
        <AppBadge tone="muted">작품 기록 중심</AppBadge>
        <AppBadge tone="muted">로그인 정보 제외</AppBadge>
        <AppBadge tone="muted">검색 key 제외</AppBadge>
      </Group>
    </SectionCard>
  );
}
