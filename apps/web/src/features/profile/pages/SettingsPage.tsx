import { PasswordInput, Stack, Text } from '@mantine/core';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { FutureFeaturePage } from '../../../shared/components/FutureFeaturePage';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  localArchiveService,
  type LocalArchiveImportPreview,
} from '../../archive/services/local-archive.service';
import {
  importsService,
  type ImportProviderStatus,
} from '../../imports/services/imports.service';
import { getWorkTypeLabel } from '../../works/utils/work-options';

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return '서버 자격 증명';
    case 'user':
      return '사용자 키';
    case 'none':
    default:
      return '추가 키 없음';
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.credentialMode === 'none') {
    return '바로 사용 가능';
  }

  return status.configured ? '준비됨' : '설정 필요';
}

function downloadTextFile(filename: string, type: string, content: string) {
  const blob = new Blob([content], {
    type,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { mode } = useAuthSession();
  const [providerStatuses, setProviderStatuses] = useState<
    ImportProviderStatus[]
  >([]);
  const [ttbKey, setTtbKey] = useState('');
  const [isLoadingProviderStatuses, setIsLoadingProviderStatuses] =
    useState(false);
  const [isSavingAladinKey, setIsSavingAladinKey] = useState(false);
  const [isDeletingAladinKey, setIsDeletingAladinKey] = useState(false);
  const [isExportingArchive, setIsExportingArchive] = useState(false);
  const [isImportingArchive, setIsImportingArchive] = useState(false);
  const [archiveImportPreview, setArchiveImportPreview] =
    useState<LocalArchiveImportPreview | null>(null);
  const [pendingArchiveImport, setPendingArchiveImport] = useState<
    string | null
  >(null);
  const [archiveFeedback, setArchiveFeedback] = useState<{
    message: string;
    tone: 'error' | 'info' | 'success';
  } | null>(null);
  const [aladinFeedback, setAladinFeedback] = useState<{
    message: string;
    tone: 'error' | 'info' | 'success';
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProviderStatuses() {
      if (mode !== 'authenticated') {
        setProviderStatuses([]);
        setAladinFeedback(null);

        return;
      }

      try {
        setIsLoadingProviderStatuses(true);
        const statuses = await importsService.listProviders();

        if (!isCancelled) {
          setProviderStatuses(statuses);
          setAladinFeedback(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setAladinFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Aladin 설정 상태를 불러오지 못했습니다.',
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProviderStatuses(false);
        }
      }
    }

    void loadProviderStatuses();

    return () => {
      isCancelled = true;
    };
  }, [mode]);

  async function handleSaveAladinKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ttbKey.trim()) {
      setAladinFeedback({
        tone: 'error',
        message: 'Aladin TTBKey를 입력해주세요.',
      });

      return;
    }

    try {
      setIsSavingAladinKey(true);
      const status = await importsService.saveAladinKey(ttbKey);

      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === status.provider
            ? { ...entry, configured: true }
            : entry,
        ),
      );
      setTtbKey('');
      setAladinFeedback({
        tone: 'success',
        message: 'Aladin TTBKey를 저장했습니다.',
      });
    } catch (error) {
      setAladinFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Aladin TTBKey를 저장하지 못했습니다.',
      });
    } finally {
      setIsSavingAladinKey(false);
    }
  }

  async function handleDeleteAladinKey() {
    try {
      setIsDeletingAladinKey(true);
      await importsService.deleteAladinKey();
      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === 'aladin' ? { ...entry, configured: false } : entry,
        ),
      );
      setTtbKey('');
      setAladinFeedback({
        tone: 'success',
        message: 'Aladin TTBKey를 삭제했습니다.',
      });
    } catch (error) {
      setAladinFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Aladin TTBKey를 삭제하지 못했습니다.',
      });
    } finally {
      setIsDeletingAladinKey(false);
    }
  }

  async function handleExportJson() {
    try {
      setIsExportingArchive(true);
      setArchiveFeedback(null);
      const content = await localArchiveService.createJsonExportText();

      downloadTextFile(
        `work-archive-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
        content,
      );
      setArchiveFeedback({
        tone: 'success',
        message: 'JSON 백업 파일을 만들었습니다.',
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 만들지 못했습니다.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  }

  async function handleExportCsv() {
    try {
      setIsExportingArchive(true);
      setArchiveFeedback(null);
      const content = await localArchiveService.createCsvExportText();

      downloadTextFile(
        `work-archive-records-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
        content,
      );
      setArchiveFeedback({
        tone: 'success',
        message: 'CSV 내보내기 파일을 만들었습니다.',
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'CSV 파일을 만들지 못했습니다.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const preview = await localArchiveService.previewImport(content);

      setPendingArchiveImport(content);
      setArchiveImportPreview(preview);
      setArchiveFeedback({
        tone: 'info',
        message: '가져오기 전 미리보기를 확인하세요.',
      });
    } catch (error) {
      setPendingArchiveImport(null);
      setArchiveImportPreview(null);
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 읽지 못했습니다.',
      });
    } finally {
      event.currentTarget.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!pendingArchiveImport) {
      return;
    }

    try {
      setIsImportingArchive(true);
      const result = await localArchiveService.importJson(pendingArchiveImport);

      setPendingArchiveImport(null);
      setArchiveImportPreview(null);
      setArchiveFeedback({
        tone: 'success',
        message: `작품 ${result.importedWorkCount}개와 권별 기록 ${result.importedReleaseRecordCount}개를 현재 로컬 아카이브로 가져왔습니다.`,
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 가져오지 못했습니다.',
      });
    } finally {
      setIsImportingArchive(false);
    }
  }

  const aladinStatus =
    providerStatuses.find((status) => status.provider === 'aladin') ?? null;

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton to="/account">계정 홈으로 돌아가기</AppLinkButton>
      }
      description="설정은 메인 제품 경험과 분리된 계정 관리 맥락에서 확장합니다."
      eyebrow="설정"
      title="설정"
    >
      <SectionCard>
        <SectionIntro
          description="이번 foundation 패스에서는 표시 모드만 먼저 안정적으로 분리해 유지보수 비용을 낮춥니다."
          eyebrow="표시 모드"
          title="라이트·다크 모드"
        />

        <Text c="var(--app-text-muted)">
          선택한 모드는 로컬 저장소에 보존되고, 메인 레이아웃과 계정 화면에
          동일하게 적용됩니다.
        </Text>

        <ThemeToggleControl />
      </SectionCard>

      <SectionCard>
        <SectionIntro
          description="현재 브라우저의 로컬 아카이브를 파일로 보관하거나, 이전에 내보낸 JSON 백업을 현재 아카이브로 가져옵니다."
          eyebrow="데이터 소유권"
          title="로컬 백업과 복구"
        />

        <Text c="var(--app-text-muted)">
          JSON 백업은 작품과 권별 기록을 복구하기 위한 형식입니다. CSV는 사람이
          읽기 쉬운 목록 내보내기이며 다시 가져오기용 형식은 아닙니다. 가져온
          기록은 기존 기록을 덮어쓰지 않고 local-first 기록으로 추가됩니다.
        </Text>

        <ActionRow>
          <AppButton
            disabled={isExportingArchive}
            onClick={() => void handleExportJson()}
            tone="primary"
            type="button"
          >
            JSON 백업 내보내기
          </AppButton>
          <AppButton
            disabled={isExportingArchive}
            onClick={() => void handleExportCsv()}
            tone="secondary"
            type="button"
          >
            CSV 내보내기
          </AppButton>
        </ActionRow>

        <Stack gap="sm">
          <Text c="var(--app-text-muted)" fw={700} size="sm">
            JSON 백업 가져오기
          </Text>
          <input
            accept="application/json,.json"
            aria-label="JSON 백업 파일 선택"
            onChange={(event) => void handleImportFileChange(event)}
            type="file"
          />
        </Stack>

        {archiveImportPreview && (
          <SectionCard padding="lg" tone="subtle">
            <SectionIntro
              description="기존 기록은 보존하고, ID가 겹치는 항목은 새 ID로 가져옵니다. syncQueue는 백업 파일에서 복원하지 않고, 가져온 활성 기록을 새 local-first 생성으로 처리합니다."
              eyebrow="가져오기 미리보기"
              title="가져올 기록 확인"
              titleOrder={3}
            />
            <ActionRow>
              <AppBadge tone="accent">
                작품 {archiveImportPreview.workCount}개
              </AppBadge>
              <AppBadge tone="accent">
                권별 기록 {archiveImportPreview.releaseRecordCount}개
              </AppBadge>
              <AppBadge tone="warning">
                제목 중복 후보 {archiveImportPreview.duplicateTitleCount}개
              </AppBadge>
              <AppBadge tone="muted">
                ID 충돌 {archiveImportPreview.idCollisionCount}개
              </AppBadge>
            </ActionRow>
            <ActionRow>
              <AppButton
                disabled={isImportingArchive}
                loading={isImportingArchive}
                onClick={() => void handleConfirmImport()}
                tone="primary"
                type="button"
              >
                현재 아카이브로 가져오기
              </AppButton>
              <AppButton
                disabled={isImportingArchive}
                onClick={() => {
                  setPendingArchiveImport(null);
                  setArchiveImportPreview(null);
                  setArchiveFeedback(null);
                }}
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

        <Text c="var(--app-text-muted)" size="sm">
          로컬 데이터 초기화가 필요하다면 먼저 JSON 백업을 만든 뒤 브라우저
          사이트 데이터 삭제 또는 개발자 도구의 IndexedDB 초기화를 사용하세요.
        </Text>
      </SectionCard>

      <SectionCard>
        <SectionIntro
          description="Quick Add가 어떤 provider를 바로 쓸 수 있는지, 어떤 provider가 별도 키를 요구하는지 먼저 확인합니다."
          eyebrow="Provider 상태"
          title="외부 검색 준비 상태"
        />

        {mode !== 'authenticated' ? (
          <Text c="var(--app-text-muted)">
            로그인하면 provider 준비 상태와 개인 Aladin 키 설정을 함께 확인할 수
            있습니다.
          </Text>
        ) : isLoadingProviderStatuses ? (
          <Text c="var(--app-text-muted)">
            provider 상태를 불러오는 중입니다.
          </Text>
        ) : (
          <Stack gap="sm">
            {providerStatuses.map((status) => (
              <SectionCard key={status.provider} padding="lg" tone="subtle">
                <Stack gap="xs">
                  <ActionRow>
                    <AppBadge tone={status.configured ? 'success' : 'muted'}>
                      {getProviderStatusLabel(status)}
                    </AppBadge>
                    <AppBadge>
                      {getCredentialModeLabel(status.credentialMode)}
                    </AppBadge>
                  </ActionRow>

                  <Text fw={700}>{status.label ?? status.provider}</Text>
                  {status.mediumTypes && status.mediumTypes.length > 0 && (
                    <Text c="var(--app-text-muted)" size="sm">
                      지원 매체:{' '}
                      {status.mediumTypes.map(getWorkTypeLabel).join(', ')}
                    </Text>
                  )}
                </Stack>
              </SectionCard>
            ))}
          </Stack>
        )}
      </SectionCard>

      <SectionCard>
        <SectionIntro
          description="Quick Add에서 Aladin 도서 검색 후보를 가져올 때 사용할 사용자별 TTBKey를 저장합니다. 저장된 키 값은 다시 표시하지 않습니다."
          eyebrow="외부 검색"
          title="Aladin Book 연동"
        />

        {mode !== 'authenticated' ? (
          <Text c="var(--app-text-muted)">
            Aladin 외부 검색은 로그인한 계정에서 TTBKey를 등록한 경우에만 사용할
            수 있습니다.
          </Text>
        ) : (
          <Stack gap="md">
            <ActionRow>
              <AppBadge tone={aladinStatus?.configured ? 'success' : 'muted'}>
                {isLoadingProviderStatuses
                  ? '상태 확인 중'
                  : aladinStatus?.configured
                    ? '키가 등록되어 있습니다'
                    : '키가 등록되어 있지 않습니다'}
              </AppBadge>
              <Text c="var(--app-text-muted)" size="sm">
                도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)
              </Text>
            </ActionRow>

            <form onSubmit={handleSaveAladinKey}>
              <Stack gap="sm">
                <PasswordInput
                  label="Aladin TTBKey"
                  onChange={(event) => setTtbKey(event.currentTarget.value)}
                  placeholder="발급받은 TTBKey를 입력하세요"
                  value={ttbKey}
                />
                <ActionRow>
                  <AppButton
                    disabled={isDeletingAladinKey}
                    loading={isSavingAladinKey}
                    tone="primary"
                    type="submit"
                  >
                    Aladin 키 저장
                  </AppButton>
                  <AppButton
                    disabled={!aladinStatus?.configured || isSavingAladinKey}
                    loading={isDeletingAladinKey}
                    onClick={handleDeleteAladinKey}
                    tone="danger"
                    type="button"
                  >
                    Aladin 키 삭제
                  </AppButton>
                </ActionRow>
              </Stack>
            </form>

            {aladinFeedback && (
              <FeedbackMessage tone={aladinFeedback.tone}>
                {aladinFeedback.message}
              </FeedbackMessage>
            )}
          </Stack>
        )}
      </SectionCard>

      <FutureFeaturePage
        description="설정은 계정, 동기화 정책, 테마, 로컬 데이터 관리처럼 개인 아카이브 운영에 필요한 항목을 모읍니다."
        eyebrow="계정 설정"
        highlights={[
          {
            title: '계정 설정',
            description:
              '계정 정보와 로그인 세션, 개인 provider 키 설정을 여기에 모읍니다.',
          },
          {
            title: '동기화 설정',
            description:
              '수동 동기화는 이미 사용할 수 있고, 이후 자동 동기화 정책도 이 계층에서 다룹니다.',
          },
          {
            title: '환경 설정',
            description:
              '테마와 표시 밀도처럼 서비스 경험을 조정하는 옵션이 이곳에 들어올 예정입니다.',
          },
        ]}
        template="bare"
        title="설정 준비 상태"
      />
    </AccountPageTemplate>
  );
}
