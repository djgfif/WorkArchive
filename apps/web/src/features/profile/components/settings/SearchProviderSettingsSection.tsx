import {
  Button,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import type { FormEvent } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '../../../../shared/components/AppPrimitives';
import type { ImportProviderStatus } from '../../../imports/services/imports.service';
import { getWorkTypeLabel } from '../../../works/utils/work-options';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles as Record<string, string>;

interface SearchProviderSettingsSectionProps {
  credentialDraft: Record<string, string>;
  deletingProviderId: string | null;
  feedback: SettingsFeedback | null;
  isLoadingProviderStatuses: boolean;
  mode: SettingsAuthMode;
  onDeleteProviderKey: () => void;
  onSaveProviderKey: () => void;
  onSelectProvider: (provider: string) => void;
  onUpdateCredentialField: (name: string, value: string) => void;
  providerStatuses: ImportProviderStatus[];
  savingProviderId: string | null;
  selectedProvider: ImportProviderStatus | null;
  selectedProviderId: string | null;
}

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return '서버 기본 키';
    case 'user':
      return '개인 키 필요';
    case 'none':
    default:
      return '공개 검색';
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.credentialMode === 'none') {
    return '공개 사용';
  }

  return status.configured ? '키 등록됨' : '키 필요';
}

function getProviderStatusTone(status: ImportProviderStatus) {
  if (status.configured) {
    return 'success';
  }

  return status.credentialMode === 'user' ? 'warning' : 'muted';
}

function ProviderStatusCard({ status }: { status: ImportProviderStatus }) {
  return (
    <SectionCard padding="md" tone="subtle">
      <Stack gap="xs">
        <ActionRow>
          <AppBadge tone={getProviderStatusTone(status)}>
            {getProviderStatusLabel(status)}
          </AppBadge>
          <AppBadge>{getCredentialModeLabel(status.credentialMode)}</AppBadge>
        </ActionRow>
        <Text fw={800}>{status.label ?? status.provider}</Text>
        {status.mediumTypes && status.mediumTypes.length > 0 && (
          <Text c="dimmed" size="sm">
            지원 매체: {status.mediumTypes.map(getWorkTypeLabel).join(', ')}
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}

export function SearchProviderSettingsSection({
  credentialDraft,
  deletingProviderId,
  feedback,
  isLoadingProviderStatuses,
  mode,
  onDeleteProviderKey,
  onSaveProviderKey,
  onSelectProvider,
  onUpdateCredentialField,
  providerStatuses,
  savingProviderId,
  selectedProvider,
  selectedProviderId,
}: SearchProviderSettingsSectionProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveProviderKey();
  }

  const publicProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'none',
  ).length;
  const configuredProviderCount = providerStatuses.filter(
    (status) => status.configured,
  ).length;
  const keyManagedProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'user',
  ).length;
  const keyRequiredProviderCount = providerStatuses.filter(
    (status) => status.credentialMode === 'user' && !status.configured,
  ).length;
  const selectedLabel = selectedProvider?.label ?? selectedProvider?.provider;
  const isSavingSelected =
    selectedProvider !== null && savingProviderId === selectedProvider.provider;
  const isDeletingSelected =
    selectedProvider !== null &&
    deletingProviderId === selectedProvider.provider;

  return (
    <SectionCard>
      <SectionIntro
        description="공개 검색 provider와 개인 API key가 필요한 provider를 한 곳에서 확인하고 관리합니다. 저장된 key 값은 다시 표시하지 않으며 백업에도 포함하지 않습니다."
        eyebrow="검색 소스와 API 키"
        title="Search provider 관리"
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="dimmed">
            공개 검색 provider는 계속 사용할 수 있습니다. 개인 API key vault는
            Google 계정으로 로그인한 뒤 계정별로 관리합니다.
          </Text>
          <ActionRow>
            <AppBadge tone="success">공개 검색 사용 가능</AppBadge>
            <AppBadge tone="muted">키 vault는 Google 계정 필요</AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text aria-busy="true" c="dimmed">
          검색 provider 상태를 불러오는 중입니다.
        </Text>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <SectionCard padding="md" tone="subtle">
              <Text c="dimmed" fw={700} size="xs">
                공개 검색
              </Text>
              <Text fw={900} size="xl">
                {publicProviderCount}
              </Text>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Text c="dimmed" fw={700} size="xs">
                키 필요
              </Text>
              <Text fw={900} size="xl">
                {keyRequiredProviderCount}
              </Text>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Text c="dimmed" fw={700} size="xs">
                키 등록됨
              </Text>
              <Text fw={900} size="xl">
                {configuredProviderCount}
              </Text>
            </SectionCard>
          </SimpleGrid>

          <div className={css.twoColumnPanel ?? ''}>
            <Stack gap="md">
              <SectionIntro
                description="검색 소스별 준비 상태입니다."
                eyebrow="Provider list"
                title="전체 provider"
                titleOrder={3}
              />
              <div className={css.providerList ?? ''}>
                {providerStatuses.map((status) =>
                  status.credentialMode === 'user' ? (
                    <Button
                      className={css.providerButton ?? ''}
                      color="archive"
                      fullWidth
                      justify="space-between"
                      key={status.provider}
                      onClick={() => onSelectProvider(status.provider)}
                      radius="md"
                      rightSection={
                        <AppBadge tone={getProviderStatusTone(status)}>
                          {getProviderStatusLabel(status)}
                        </AppBadge>
                      }
                      type="button"
                      variant={
                        status.provider === selectedProviderId
                          ? 'light'
                          : 'subtle'
                      }
                    >
                      {status.label ?? status.provider}
                    </Button>
                  ) : (
                    <ProviderStatusCard
                      key={status.provider}
                      status={status}
                    />
                  ),
                )}
              </div>
            </Stack>

            <SectionCard padding="lg" tone="subtle">
              {selectedProvider ? (
                <Stack gap="md">
                  <Stack gap={4}>
                    <ActionRow>
                      <Text fw={800}>{selectedLabel}</Text>
                      <AppBadge
                        tone={selectedProvider.configured ? 'success' : 'muted'}
                      >
                        {getProviderStatusLabel(selectedProvider)}
                      </AppBadge>
                    </ActionRow>
                    <Text c="dimmed" size="sm">
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

                  <Text c="dimmed" size="sm">
                    키는 검색 요청에만 사용되며, 로컬 백업 파일에는 포함되지
                    않습니다.
                  </Text>
                </Stack>
              ) : (
                <Text c="dimmed">
                  {keyManagedProviderCount > 0
                    ? '왼쪽에서 개인 키를 등록할 provider를 선택하세요.'
                    : '등록 가능한 개인 key provider가 없습니다.'}
                </Text>
              )}

              {feedback && (
                <FeedbackMessage tone={feedback.tone}>
                  {feedback.message}
                </FeedbackMessage>
              )}
            </SectionCard>
          </div>
        </Stack>
      )}
    </SectionCard>
  );
}
