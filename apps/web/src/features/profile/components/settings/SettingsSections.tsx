import {
  Button,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import type { AuthRefreshSessionResponse } from '@work-archive/shared-types';
import type { ChangeEvent, FormEvent } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '../../../../shared/components/AppPrimitives';
import type { LocalArchiveImportPreview } from '../../../archive/services/local-archive.service';
import type { ImportProviderStatus } from '../../../imports/services/imports.service';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import { getWorkTypeLabel } from '../../../works/utils/work-options';

type SettingsAuthMode = 'authenticated' | 'guest';

function formatSessionDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return '기본 검색';
    case 'user':
      return '개인 검색 키';
    case 'none':
    default:
      return '공개 검색';
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.credentialMode === 'none') {
    return '사용 가능';
  }

  return status.configured ? '등록됨' : '키 필요';
}

function getProviderStatusTone(status: ImportProviderStatus) {
  if (status.configured) {
    return 'success';
  }

  return status.credentialMode === 'user' ? 'warning' : 'muted';
}

export function AppearanceSettingsSection() {
  return (
    <SectionCard>
      <SectionIntro
        description="아카이브를 읽기 편한 화면 톤으로 전환합니다."
        eyebrow="표시 모드"
        title="라이트·다크 모드"
      />

      <Text c="var(--mantine-color-dimmed)">
        선택한 모드는 로컬 저장소에 보존되고, 메인 레이아웃과 계정 화면에
        동일하게 적용됩니다.
      </Text>

      <ThemeToggleControl />
    </SectionCard>
  );
}

interface ExportOptionCardProps {
  buttonLabel: string;
  description: string;
  disabled: boolean;
  eyebrow: string;
  onClick: () => void;
  title: string;
  tone: 'primary' | 'secondary';
}

function ExportOptionCard({
  buttonLabel,
  description,
  disabled,
  eyebrow,
  onClick,
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

interface LocalArchiveSettingsSectionProps {
  archiveFeedback: SettingsFeedback | null;
  archiveImportPreview: LocalArchiveImportPreview | null;
  isExportingArchive: boolean;
  isImportingArchive: boolean;
  onCancelImport: () => void;
  onConfirmImport: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportFileSelect: (file: File) => Promise<void>;
}

export function LocalArchiveSettingsSection({
  archiveFeedback,
  archiveImportPreview,
  isExportingArchive,
  isImportingArchive,
  onCancelImport,
  onConfirmImport,
  onExportCsv,
  onExportJson,
  onImportFileSelect,
}: LocalArchiveSettingsSectionProps) {
  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      return;
    }

    try {
      await onImportFileSelect(file);
    } finally {
      event.currentTarget.value = '';
    }
  }

  return (
    <SectionCard>
      <SectionIntro
        description="현재 브라우저의 로컬 아카이브를 파일로 보관하고, 이전 백업을 기존 기록 위에 안전하게 더합니다."
        eyebrow="데이터 소유권"
        title="로컬 백업과 복구"
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ExportOptionCard
          buttonLabel="JSON 백업 내보내기"
          description="작품, 권별 기록, 타임라인 기록을 다시 가져올 수 있는 보관용 파일입니다."
          disabled={isExportingArchive}
          eyebrow="보관용"
          onClick={() => void onExportJson()}
          title="JSON 백업"
          tone="primary"
        />

        <ExportOptionCard
          buttonLabel="CSV 내보내기"
          description="스프레드시트에서 읽기 위한 목록 파일입니다. 다시 가져오기용 형식은 아닙니다."
          disabled={isExportingArchive}
          eyebrow="보기용"
          onClick={() => void onExportCsv()}
          title="CSV 내보내기"
          tone="secondary"
        />
      </SimpleGrid>

      <SectionCard padding="lg" tone="subtle">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap="xs">
            <Text fw={700}>JSON 백업 가져오기</Text>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              가져온 기록은 기존 기록을 덮어쓰지 않고 내 아카이브에 새 기록으로
              더해집니다.
            </Text>
          </Stack>
          <input
            accept="application/json,.json"
            aria-label="JSON 백업 파일 선택"
            onChange={(event) => void handleImportFileChange(event)}
            type="file"
          />
        </Group>
      </SectionCard>

      <ActionRow>
        <AppBadge tone="muted">작품 기록 중심</AppBadge>
        <AppBadge tone="muted">로그인 정보 제외</AppBadge>
        <AppBadge tone="muted">검색 키 제외</AppBadge>
      </ActionRow>
      <Text c="var(--mantine-color-dimmed)" size="sm">
        백업 파일은 작품, 감상, 진행 기록을 옮기는 용도입니다. 계정 로그인 정보와
        개인 검색 키는 포함하지 않습니다.
      </Text>

      {archiveImportPreview && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="기존 기록은 보존하고, 제목이 비슷한 후보도 새 기록으로 추가합니다. 같은 작품처럼 보이는 항목은 별도 기록으로 정리해 나중에 직접 살펴볼 수 있게 둡니다."
            eyebrow="가져오기 미리보기"
            title="가져올 기록 확인"
            titleOrder={3}
          />
          <ActionRow>
            <AppBadge tone="accent">
              추가할 작품 {archiveImportPreview.addWorkCount}개
            </AppBadge>
            <AppBadge tone="accent">
              추가할 권별 기록 {archiveImportPreview.addReleaseRecordCount}개
            </AppBadge>
            <AppBadge tone="accent">
              추가할 타임라인 {archiveImportPreview.addTimelineEntryCount}개
            </AppBadge>
            <AppBadge tone="muted">
              수정할 작품 {archiveImportPreview.updateWorkCount}개
            </AppBadge>
            <AppBadge tone="warning">
              중복 후보{' '}
              {archiveImportPreview.duplicateWorkCount +
                archiveImportPreview.duplicateTimelineEntryCount}
              개
            </AppBadge>
            <AppBadge tone="muted">
              따로 살펴볼 기록 {archiveImportPreview.conflictWorkCount}개
            </AppBadge>
            <AppBadge tone="muted">
              건너뛸 항목{' '}
              {archiveImportPreview.skippedWorkCount +
                archiveImportPreview.skippedReleaseRecordCount +
                archiveImportPreview.skippedTimelineEntryCount}
              개
            </AppBadge>
          </ActionRow>
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

      <Text c="var(--mantine-color-dimmed)" size="sm">
        기록을 비우기 전에는 먼저 JSON 백업을 만들어두세요. 브라우저의 사이트
        데이터 삭제 기능으로 이 기기의 기록을 초기화할 수 있습니다.
      </Text>
    </SectionCard>
  );
}

function ProviderStatusCard({ status }: { status: ImportProviderStatus }) {
  return (
    <SectionCard padding="lg" tone="subtle">
      <Stack gap="xs">
        <ActionRow>
          <AppBadge tone={getProviderStatusTone(status)}>
            {getProviderStatusLabel(status)}
          </AppBadge>
          <AppBadge>{getCredentialModeLabel(status.credentialMode)}</AppBadge>
        </ActionRow>

        <Text fw={700}>{status.label ?? status.provider}</Text>
        {status.mediumTypes && status.mediumTypes.length > 0 && (
          <Text c="var(--mantine-color-dimmed)" size="sm">
            지원 매체: {status.mediumTypes.map(getWorkTypeLabel).join(', ')}
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}

interface ProviderReadinessSectionProps {
  isLoadingProviderStatuses: boolean;
  mode: SettingsAuthMode;
  providerStatuses: ImportProviderStatus[];
}

export function ProviderReadinessSection({
  isLoadingProviderStatuses,
  mode,
  providerStatuses,
}: ProviderReadinessSectionProps) {
  const publicProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'none',
  ).length;
  const configuredProviderCount = providerStatuses.filter(
    (status) => status.configured,
  ).length;
  const keyRequiredProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'user' && !status.configured,
  ).length;

  return (
    <SectionCard>
      <SectionIntro
        description="작품 추가에서 바로 사용할 수 있는 외부 검색 소스와 별도 키가 필요한 소스를 확인합니다."
        eyebrow="외부 검색 상태"
        title="외부 검색 준비 상태"
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="var(--mantine-color-dimmed)">
            로그인하면 외부 검색 준비 상태와 개인 검색 키를 함께 확인할 수
            있습니다. 공개 검색 소스는 로그인 없이도 계속 사용할 수 있습니다.
          </Text>
          <ActionRow>
            <AppBadge tone="success">공개 검색 사용 가능</AppBadge>
            <AppBadge tone="muted">개인 검색 키는 로그인 필요</AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text aria-busy="true" c="var(--mantine-color-dimmed)">
          외부 검색 상태를 불러오는 중입니다.
        </Text>
      ) : (
        <Stack gap="sm">
          <ActionRow>
            <AppBadge tone="success">
              사용 가능 {configuredProviderCount}개
            </AppBadge>
            <AppBadge tone="accent">공개 {publicProviderCount}개</AppBadge>
            <AppBadge tone={keyRequiredProviderCount > 0 ? 'warning' : 'muted'}>
              키 필요 {keyRequiredProviderCount}개
            </AppBadge>
          </ActionRow>
          {providerStatuses.map((status) => (
            <ProviderStatusCard key={status.provider} status={status} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

interface ProviderKeyVaultSectionProps {
  credentialDraft: Record<string, string>;
  deletingProviderId: string | null;
  feedback: SettingsFeedback | null;
  isLoadingProviderStatuses: boolean;
  keyManagedProviders: ImportProviderStatus[];
  mode: SettingsAuthMode;
  onDeleteProviderKey: () => void;
  onSaveProviderKey: () => void;
  onSelectProvider: (provider: string) => void;
  onUpdateCredentialField: (name: string, value: string) => void;
  savingProviderId: string | null;
  selectedProvider: ImportProviderStatus | null;
  selectedProviderId: string | null;
}

export function ProviderKeyVaultSection({
  credentialDraft,
  deletingProviderId,
  feedback,
  isLoadingProviderStatuses,
  keyManagedProviders,
  mode,
  onDeleteProviderKey,
  onSaveProviderKey,
  onSelectProvider,
  onUpdateCredentialField,
  savingProviderId,
  selectedProvider,
  selectedProviderId,
}: ProviderKeyVaultSectionProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveProviderKey();
  }

  const selectedLabel = selectedProvider?.label ?? selectedProvider?.provider;
  const isSavingSelected =
    selectedProvider !== null && savingProviderId === selectedProvider.provider;
  const isDeletingSelected =
    selectedProvider !== null &&
    deletingProviderId === selectedProvider.provider;

  return (
    <SectionCard>
      <SectionIntro
        description="외부 검색에 필요한 개인 키를 안전하게 보관합니다. 저장된 값은 다시 표시하지 않으며 백업 파일에도 포함하지 않습니다."
        eyebrow="외부 검색"
        title="개인 검색 키"
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="var(--mantine-color-dimmed)">
            개인 검색 키는 로그인한 계정에서만 사용할 수 있습니다. Google
            Books, Open Library, AniList, TVmaze처럼 공개 검색 소스는 키 없이
            검색 보조에 계속 참여합니다.
          </Text>
          <ActionRow>
            <AppBadge tone="muted">공개 검색 사용 가능</AppBadge>
            <AppBadge tone="muted">개인 검색 키는 백업 제외</AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text c="var(--mantine-color-dimmed)">
          개인 검색 키 설정을 불러오는 중입니다.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack gap="xs">
            {keyManagedProviders.map((provider) => {
              const isSelected = provider.provider === selectedProviderId;

              return (
                <Button
                  color="archive"
                  fullWidth
                  justify="space-between"
                  key={provider.provider}
                  onClick={() => onSelectProvider(provider.provider)}
                  radius="md"
                  rightSection={
                    <AppBadge tone={provider.configured ? 'success' : 'muted'}>
                      {getProviderStatusLabel(provider)}
                    </AppBadge>
                  }
                  type="button"
                  variant={isSelected ? 'light' : 'subtle'}
                >
                  {provider.label ?? provider.provider}
                </Button>
              );
            })}
          </Stack>

          <Stack gap="md">
            {selectedProvider ? (
              <>
                <Stack gap={4}>
                  <ActionRow>
                    <Text fw={700}>{selectedLabel}</Text>
                    <AppBadge
                      tone={selectedProvider.configured ? 'success' : 'muted'}
                    >
                      {getProviderStatusLabel(selectedProvider)}
                    </AppBadge>
                  </ActionRow>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    지원 매체:{' '}
                    {(selectedProvider.mediumTypes ?? [])
                      .map(getWorkTypeLabel)
                      .join(', ')}
                  </Text>
                </Stack>

                <Divider />

                <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    {(selectedProvider.credentialFields ?? []).map((field) => (
                      <PasswordInput
                        description={field.description}
                        key={field.name}
                        label={field.label}
                        onChange={(event) =>
                          onUpdateCredentialField(
                            field.name,
                            event.currentTarget.value,
                          )
                        }
                        placeholder={`${field.label} 입력`}
                        value={credentialDraft[field.name] ?? ''}
                      />
                    ))}

                    <ActionRow>
                      <AppButton
                        disabled={isDeletingSelected}
                        loading={isSavingSelected}
                        tone="primary"
                        type="submit"
                      >
                        {selectedLabel} 키 저장
                      </AppButton>
                      <AppButton
                        disabled={
                          !selectedProvider.configured || isSavingSelected
                        }
                        loading={isDeletingSelected}
                        onClick={() => void onDeleteProviderKey()}
                        tone="danger"
                        type="button"
                      >
                        {selectedLabel} 키 삭제
                      </AppButton>
                    </ActionRow>
                  </Stack>
                </form>

                <Text c="var(--mantine-color-dimmed)" size="sm">
                  이 키는 검색 요청에만 사용하며, 로컬 백업 파일에는 포함하지 않습니다.
                </Text>
              </>
            ) : (
              <Text c="var(--mantine-color-dimmed)">
                등록 가능한 외부 검색 소스가 없습니다.
              </Text>
            )}

            {feedback && (
              <FeedbackMessage tone={feedback.tone}>
                {feedback.message}
              </FeedbackMessage>
            )}
          </Stack>
        </SimpleGrid>
      )}
    </SectionCard>
  );
}

interface LoginSessionsSectionProps {
  feedback: SettingsFeedback | null;
  isLoadingSessions: boolean;
  mode: SettingsAuthMode;
  onRefreshSessions: () => void;
  onRevokeAllSessions: () => void;
  onRevokeSession: (session: AuthRefreshSessionResponse) => void;
  revokingSessionId: string | null;
  sessions: AuthRefreshSessionResponse[];
}

export function LoginSessionsSection({
  feedback,
  isLoadingSessions,
  mode,
  onRefreshSessions,
  onRevokeAllSessions,
  onRevokeSession,
  revokingSessionId,
  sessions,
}: LoginSessionsSectionProps) {
  const hasSessions = sessions.length > 0;

  return (
    <SectionCard>
      <SectionIntro
        description="현재 로그인된 기기를 확인하고, 더 이상 사용하지 않는 기기를 해제합니다."
        eyebrow="보안"
        title="로그인된 기기"
      />

      {mode !== 'authenticated' ? (
        <Text c="var(--mantine-color-dimmed)">
          로그인하면 계정 세션을 확인하고 원격 기기의 로그인 상태를 해제할 수
          있습니다.
        </Text>
      ) : isLoadingSessions ? (
        <Text aria-busy="true" c="var(--mantine-color-dimmed)">
          세션 목록을 불러오는 중입니다.
        </Text>
      ) : !hasSessions ? (
        <Text c="var(--mantine-color-dimmed)">
          현재 확인된 활성 세션이 없습니다.
        </Text>
      ) : (
        <Stack gap="sm">
          <ActionRow>
            <AppBadge tone="success">활성 세션 {sessions.length}개</AppBadge>
            <AppBadge tone="accent">
              로그인 유지 {sessions.filter((session) => session.rememberMe).length}
              개
            </AppBadge>
            <AppBadge tone="muted">
              현재 기기{' '}
              {sessions.filter((session) => session.current).length}개
            </AppBadge>
          </ActionRow>

          {sessions.map((session) => (
            <SectionCard
              key={session.id}
              padding="md"
              tone="subtle"
            >
              <Stack gap="xs">
                <ActionRow>
                  <Text fw={700}>
                    {session.current ? '현재 기기' : '다른 기기'}
                  </Text>
                  <AppBadge tone={session.current ? 'success' : 'muted'}>
                    {session.current ? '이 기기' : '활성'}
                  </AppBadge>
                  <AppBadge tone={session.rememberMe ? 'accent' : 'muted'}>
                    {session.rememberMe ? '로그인 유지' : '브라우저 세션'}
                  </AppBadge>
                </ActionRow>

                <Text c="var(--mantine-color-dimmed)" size="sm">
                  마지막 사용: {formatSessionDate(session.lastUsedAt)} | 생성:{' '}
                  {formatSessionDate(session.createdAt)} | 만료:{' '}
                  {formatSessionDate(session.expiresAt)}
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  기기: {session.userAgent || '알 수 없음'} | IP:{' '}
                  {session.ipAddress || '알 수 없음'}
                </Text>

                <ActionRow>
                  <AppButton
                    loading={revokingSessionId === session.id}
                    onClick={() => onRevokeSession(session)}
                    tone={session.current ? 'danger' : 'secondary'}
                    type="button"
                  >
                    {session.current ? '이 기기 로그아웃' : '세션 해제'}
                  </AppButton>
                </ActionRow>
              </Stack>
            </SectionCard>
          ))}

          <ActionRow>
            <AppButton
              disabled={revokingSessionId !== null}
              onClick={onRefreshSessions}
              tone="quiet"
              type="button"
            >
              다시 불러오기
            </AppButton>
            <AppButton
              loading={revokingSessionId === 'all'}
              onClick={onRevokeAllSessions}
              tone="danger"
              type="button"
            >
              모든 기기 로그아웃
            </AppButton>
          </ActionRow>
          <Text c="var(--mantine-color-dimmed)" size="sm">
            현재 기기를 로그아웃하면 즉시 게스트 모드로 돌아갑니다. 다른 기기
            세션 해제는 해당 기기의 다음 요청부터 적용됩니다.
          </Text>
        </Stack>
      )}

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage>
      )}
    </SectionCard>
  );
}

