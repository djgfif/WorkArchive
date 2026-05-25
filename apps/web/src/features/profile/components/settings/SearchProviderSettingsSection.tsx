import {
  Box,
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
} from '@shared/components/AppPrimitives';
import type { ImportProviderStatus } from '@features/imports';
import { getWorkTypeLabel } from '@features/works';
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
  onTestProviderKey: () => void;
  onUpdateCredentialField: (name: string, value: string) => void;
  providerStatuses: ImportProviderStatus[];
  savingProviderId: string | null;
  selectedProvider: ImportProviderStatus | null;
  selectedProviderId: string | null;
  testingProviderId: string | null;
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return '서버 관리';
    case 'user':
      return 'API 키 필요';
    case 'none':
    default:
      return '키 없이 사용';
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.circuitState === 'open') {
    return '일시 중단';
  }

  if (status.credentialMode === 'none') {
    return '사용 가능';
  }

  if (status.credentialMode === 'server') {
    return status.configured ? '사용 가능' : '서버 설정 필요';
  }

  return status.configured ? '연결됨' : '미연결';
}

function getProviderStatusTone(status: ImportProviderStatus) {
  if (status.circuitState === 'open') {
    return 'warning' as const;
  }

  if (status.configured || status.credentialMode === 'none') {
    return 'success' as const;
  }

  return status.credentialMode === 'user' ? 'warning' as const : 'muted' as const;
}

function getProviderBenefit(status: ImportProviderStatus) {
  switch (status.provider) {
    case 'aladin':
      return '국내 도서, 라이트노벨, 만화의 표지와 출판 정보를 더 정확하게 채웁니다.';
    case 'tmdb':
      return '영화와 드라마의 포스터, 공개일, 원제 정보를 안정적으로 가져옵니다.';
    case 'naver_book':
      return '국내 도서 검색 결과와 한국어 제목 매칭을 보강합니다.';
    case 'kakao_book':
      return '카카오 도서 검색으로 국내 서지 후보를 추가로 비교합니다.';
    case 'naver_web':
      return '웹소설과 웹툰의 국내 검색 후보를 더 넓게 찾습니다.';
    case 'kakao_web':
      return '카카오 검색 기반으로 웹소설, 웹툰 후보 탐색 범위를 넓힙니다.';
    case 'kobis':
      return '국내 영화 개봉 정보와 영화 식별 정확도를 보강합니다.';
    case 'manual':
      return '검색 결과가 부족할 때 직접 입력으로 기록을 완성합니다.';
    case 'anilist':
      return '애니메이션과 만화 후보를 키 없이 빠르게 찾습니다.';
    case 'google_books':
      return '도서와 웹소설 후보를 공개 검색으로 보강합니다.';
    case 'open_library':
      return '해외 도서 서지 정보를 키 없이 보조 검색합니다.';
    case 'tvmaze':
      return '드라마와 시리즈 정보를 키 없이 보조 검색합니다.';
    case 'wikidata':
      return '공개 Wikidata/Wikimedia 정보로 별칭, 제작진, 시리즈 관계와 외부 식별자를 보강합니다.';
    case 'brave_search':
      return '사용자 개인 Brave Search API key가 필요합니다. 서버 운영자 키를 사용하지 않습니다.';
    case 'tavily_search':
      return '사용자 개인 Tavily API key가 필요합니다. 서버 운영자 키를 사용하지 않습니다.';
    default:
      return '작품 추가 검색에서 후보와 메타데이터를 보강합니다.';
  }
}

function formatMediumTypes(status: ImportProviderStatus) {
  return (status.mediumTypes ?? []).map(getWorkTypeLabel).join(', ');
}

function ProviderSummaryCard({
  label,
  tone = 'muted',
  value,
}: {
  label: string;
  tone?: 'accent' | 'muted' | 'success' | 'warning';
  value: number;
}) {
  return (
    <SectionCard padding="md" tone="subtle">
      <Stack gap={4}>
        <Text c="dimmed" fw={760} size="xs">
          {label}
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Text fw={900} size="xl">
            {value}
          </Text>
          <AppBadge tone={tone}>{label}</AppBadge>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function PublicProviderCard({ status }: { status: ImportProviderStatus }) {
  return (
    <Box className={css.providerInfoCard ?? ''}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text className={css.providerInfoTitle ?? ''}>
          {status.label ?? status.provider}
        </Text>
        <AppBadge tone={getProviderStatusTone(status)}>
          {getCredentialModeLabel(status.credentialMode)}
        </AppBadge>
      </Group>
      <Text className={css.providerInfoBenefit ?? ''}>
        {getProviderBenefit(status)}
      </Text>
      {status.mediumTypes && status.mediumTypes.length > 0 && (
        <Text className={css.providerInfoMeta ?? ''}>
          {formatMediumTypes(status)}
        </Text>
      )}
      {status.circuitState === 'open' && (
        <Text className={css.providerInfoMeta ?? ''}>
          반복 실패로 잠시 쉬는 중입니다.
        </Text>
      )}
    </Box>
  );
}

function KeyProviderButton({
  isSelected,
  onSelect,
  status,
}: {
  isSelected: boolean;
  onSelect: () => void;
  status: ImportProviderStatus;
}) {
  return (
    <button
      className={cx(
        css.keyProviderButton ?? '',
        isSelected && (css.keyProviderButtonActive ?? ''),
      )}
      onClick={onSelect}
      type="button"
    >
      <Group align="flex-start" gap="sm" justify="space-between" wrap="nowrap">
        <Stack gap={4} miw={0}>
          <Text className={css.keyProviderTitle ?? ''}>
            {status.label ?? status.provider}
          </Text>
          <Text className={css.keyProviderMeta ?? ''}>
            {formatMediumTypes(status)}
          </Text>
          <Text className={css.keyProviderMeta ?? ''}>
            {getProviderBenefit(status)}
          </Text>
          {status.circuitState === 'open' && (
            <Text className={css.keyProviderMeta ?? ''}>
              반복 실패로 잠시 쉬는 중입니다.
            </Text>
          )}
        </Stack>
        <AppBadge tone={getProviderStatusTone(status)}>
          {getProviderStatusLabel(status)}
        </AppBadge>
      </Group>
    </button>
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
  onTestProviderKey,
  onUpdateCredentialField,
  providerStatuses,
  savingProviderId,
  selectedProvider,
  selectedProviderId,
  testingProviderId,
}: SearchProviderSettingsSectionProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveProviderKey();
  }

  const keyProviders = providerStatuses.filter(
    (status) => status.credentialMode === 'user',
  );
  const noKeyProviders = providerStatuses.filter(
    (status) => status.credentialMode !== 'user',
  );
  const configuredKeyProviderCount = keyProviders.filter(
    (status) => status.configured,
  ).length;
  const keyRequiredProviderCount = keyProviders.filter(
    (status) => !status.configured,
  ).length;
  const selectedLabel = selectedProvider?.label ?? selectedProvider?.provider;
  const isSavingSelected =
    selectedProvider !== null && savingProviderId === selectedProvider.provider;
  const isDeletingSelected =
    selectedProvider !== null &&
    deletingProviderId === selectedProvider.provider;
  const isTestingSelected =
    selectedProvider !== null && testingProviderId === selectedProvider.provider;

  return (
    <SectionCard>
      <SectionIntro
        description="API 키가 필요한 검색 소스와 키 없이 바로 쓰는 소스를 분리했습니다. 키를 등록하면 작품 추가에서 더 정확한 후보, 표지, 공개일, 국내 검색 결과를 보강할 수 있습니다."
        eyebrow="검색 소스와 API 키"
        title="Search provider 관리"
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="dimmed">
            공개 검색 소스는 계속 사용할 수 있습니다. 개인 API 키는 로그인한 계정의 보안 저장소에서만 관리됩니다.
          </Text>
          <ActionRow>
            <AppBadge tone="success">키 없이 검색 가능</AppBadge>
            <AppBadge tone="muted">개인 키 관리는 로그인 필요</AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text aria-busy="true" c="dimmed">
          검색 provider 상태를 불러오는 중입니다.
        </Text>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <ProviderSummaryCard
              label="키 없이 사용"
              tone="success"
              value={noKeyProviders.length}
            />
            <ProviderSummaryCard
              label="API 연결됨"
              tone="accent"
              value={configuredKeyProviderCount}
            />
            <ProviderSummaryCard
              label="연결 가능"
              tone={keyRequiredProviderCount > 0 ? 'warning' : 'muted'}
              value={keyRequiredProviderCount}
            />
          </SimpleGrid>

          <div className={css.providerManagementGrid ?? ''}>
            <Stack gap="md">
              <SectionCard padding="md" tone="subtle">
                <Stack gap="md">
                  <SectionIntro
                    description="등록하면 검색 결과의 정확도와 메타데이터 품질이 좋아지는 소스입니다."
                    eyebrow="API 키 필요"
                    title="연결 가능한 소스"
                    titleOrder={3}
                  />
                  <div className={css.keyProviderList ?? ''}>
                    {keyProviders.map((status) => (
                      <KeyProviderButton
                        isSelected={status.provider === selectedProviderId}
                        key={status.provider}
                        onSelect={() => onSelectProvider(status.provider)}
                        status={status}
                      />
                    ))}
                  </div>
                </Stack>
              </SectionCard>

            </Stack>

            <SectionCard
              className={css.providerVaultPanel ?? ''}
              padding="lg"
              tone="subtle"
            >
              {selectedProvider ? (
                <Stack gap="md">
                  <Stack gap={6}>
                    <ActionRow>
                      <Text fw={850}>{selectedLabel}</Text>
                      <AppBadge
                        tone={selectedProvider.configured ? 'success' : 'warning'}
                      >
                        {getProviderStatusLabel(selectedProvider)}
                      </AppBadge>
                    </ActionRow>
                    <Text c="dimmed" size="sm">
                      {getProviderBenefit(selectedProvider)}
                    </Text>
                    <Text c="dimmed" size="sm">
                      지원 유형: {formatMediumTypes(selectedProvider)}
                    </Text>
                  </Stack>

                  <Box className={css.providerSecurityBox ?? ''}>
                    <Text fw={850} size="sm">
                      보안 저장 방식
                    </Text>
                    <Text c="dimmed" size="sm">
                      저장된 키 값은 다시 표시하지 않습니다. 검색 요청에만 사용하며
                      JSON/CSV 백업 파일에는 포함하지 않습니다. 필요하면 언제든 삭제할 수 있습니다.
                    </Text>
                  </Box>

                  <Divider />

                  <form onSubmit={handleSubmit}>
                    <Stack gap="sm">
                      {(selectedProvider.credentialFields ?? []).map((field) => (
                        <PasswordInput
                          autoComplete="new-password"
                          description={
                            field.description ??
                            '저장 후에는 값이 화면에 다시 표시되지 않습니다.'
                          }
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
                            !selectedProvider.configured ||
                            isSavingSelected ||
                            isTestingSelected
                          }
                          loading={isDeletingSelected}
                          onClick={() => void onDeleteProviderKey()}
                          tone="danger"
                          type="button"
                        >
                          {selectedLabel} 키 삭제
                        </AppButton>
                        <AppButton
                          disabled={
                            !selectedProvider.configured ||
                            isSavingSelected ||
                            isDeletingSelected
                          }
                          loading={isTestingSelected}
                          onClick={() => void onTestProviderKey()}
                          tone="secondary"
                          type="button"
                        >
                          연결 테스트
                        </AppButton>
                      </ActionRow>
                    </Stack>
                  </form>

                  {feedback && (
                    <FeedbackMessage tone={feedback.tone}>
                      {feedback.message}
                    </FeedbackMessage>
                  )}
                </Stack>
              ) : (
                <Text c="dimmed">
                  등록 가능한 개인 API 키 provider가 없습니다.
                </Text>
              )}
            </SectionCard>
          </div>

          <details className={css.publicProviderDisclosure ?? ''}>
            <summary className={css.publicProviderSummary ?? ''}>
              <Stack gap={3} miw={0}>
                <Text className={css.publicProviderSummaryTitle ?? ''}>
                  키 없이 사용 중인 기본 검색 소스
                </Text>
                <Text className={css.publicProviderSummaryDescription ?? ''}>
                  별도 관리가 필요 없는 소스입니다. 필요할 때만 펼쳐서 확인합니다.
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <AppBadge tone="success">{noKeyProviders.length}개 사용 가능</AppBadge>
                <span className={css.publicProviderChevron ?? ''} aria-hidden>
                  ↓
                </span>
              </Group>
            </summary>
            <div className={css.publicProviderGrid ?? ''}>
              {noKeyProviders.map((status) => (
                <PublicProviderCard key={status.provider} status={status} />
              ))}
            </div>
          </details>
        </Stack>
      )}
    </SectionCard>
  );
}
