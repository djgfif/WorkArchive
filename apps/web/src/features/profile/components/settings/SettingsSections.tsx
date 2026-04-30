import {
  Button,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import type { ChangeEvent, FormEvent } from 'react';

import { FutureFeaturePage } from '../../../../shared/components/FutureFeaturePage';
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

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return '서버 자격 증명';
    case 'user':
      return '개인 Key Vault';
    case 'none':
    default:
      return '공개 provider';
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.credentialMode === 'none') {
    return '사용 가능';
  }

  return status.configured ? '등록됨' : '키 필요';
}

export function AppearanceSettingsSection() {
  return (
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
  async function handleImportFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
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
          description="작품과 권별 기록을 다시 가져올 수 있는 보관용 파일입니다."
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
            <Text c="var(--app-text-muted)" size="sm">
              가져온 기록은 기존 기록을 덮어쓰지 않고 새 local-first 기록으로
              추가됩니다.
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
        <AppBadge tone="muted">appMeta 복원 안 함</AppBadge>
        <AppBadge tone="muted">syncQueue 복원 안 함</AppBadge>
        <AppBadge tone="muted">API key 제외</AppBadge>
      </ActionRow>
      <Text c="var(--app-text-muted)" size="sm">
        백업 파일의 syncQueue는 특정 기기의 작업 대기열이므로 가져오기에서
        복원하지 않습니다.
      </Text>

      {archiveImportPreview && (
        <SectionCard padding="lg" tone="subtle">
          <SectionIntro
            description="기존 기록은 보존하고, 제목 중복 후보도 새 기록으로 추가합니다. ID가 겹치는 항목은 새 ID로 가져오며, syncQueue와 appMeta는 백업에서 복원하지 않습니다."
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
            <AppBadge tone="muted">
              건너뛸 권별 기록 {archiveImportPreview.skippedReleaseRecordCount}개
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

      <Text c="var(--app-text-muted)" size="sm">
        로컬 데이터 초기화가 필요하다면 먼저 JSON 백업을 만든 뒤 브라우저
        사이트 데이터 삭제 또는 개발자 도구의 IndexedDB 초기화를 사용하세요.
      </Text>
    </SectionCard>
  );
}

function ProviderStatusCard({ status }: { status: ImportProviderStatus }) {
  return (
    <SectionCard padding="lg" tone="subtle">
      <Stack gap="xs">
        <ActionRow>
          <AppBadge tone={status.configured ? 'success' : 'muted'}>
            {getProviderStatusLabel(status)}
          </AppBadge>
          <AppBadge>{getCredentialModeLabel(status.credentialMode)}</AppBadge>
        </ActionRow>

        <Text fw={700}>{status.label ?? status.provider}</Text>
        {status.mediumTypes && status.mediumTypes.length > 0 && (
          <Text c="var(--app-text-muted)" size="sm">
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
  return (
    <SectionCard>
      <SectionIntro
        description="Quick Add가 어떤 provider를 바로 쓸 수 있는지, 어떤 provider가 별도 키를 요구하는지 먼저 확인합니다."
        eyebrow="Provider 상태"
        title="외부 검색 준비 상태"
      />

      {mode !== 'authenticated' ? (
        <Text c="var(--app-text-muted)">
          로그인하면 provider 준비 상태와 개인 API Key Vault를 함께 확인할 수
          있습니다. 공개 provider는 로그인 없이도 계속 사용할 수 있습니다.
        </Text>
      ) : isLoadingProviderStatuses ? (
        <Text c="var(--app-text-muted)">
          provider 상태를 불러오는 중입니다.
        </Text>
      ) : (
        <Stack gap="sm">
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
        description="외부 검색 provider별 개인 API credential을 암호화해 저장합니다. 저장된 raw key 값은 다시 표시하지 않으며 백업 파일에도 포함하지 않습니다."
        eyebrow="외부 검색"
        title="API Key Vault"
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="var(--app-text-muted)">
            API Key Vault는 로그인한 계정에서만 사용할 수 있습니다. Google
            Books, Open Library, AniList, TVmaze처럼 공개 provider는 키 없이
            검색 보조에 계속 참여합니다.
          </Text>
          <ActionRow>
            <AppBadge tone="muted">공개 provider 사용 가능</AppBadge>
            <AppBadge tone="muted">개인 API key는 백업 제외</AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text c="var(--app-text-muted)">API Key Vault를 불러오는 중입니다.</Text>
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
                  styles={{
                    inner: {
                      justifyContent: 'space-between',
                    },
                  }}
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
                  <Text c="var(--app-text-muted)" size="sm">
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

                <Text c="var(--app-text-muted)" size="sm">
                  이 credential은 검색 요청에만 사용하며, 로컬 아카이브
                  export/import에는 포함하지 않습니다.
                </Text>
              </>
            ) : (
              <Text c="var(--app-text-muted)">
                등록 가능한 외부 검색 provider가 없습니다.
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

export function SettingsFutureSection() {
  return (
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
  );
}
