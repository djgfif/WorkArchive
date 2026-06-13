import {
  Box,
  Divider,
  Group,
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
import { appI18n, formatAppNumber, useAppTranslation } from '@app/i18n';
import type { ImportProviderStatus } from '@features/imports';
import { getWorkTypeLabel } from '@features/works';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';
import { cx } from '@shared/utils/class-names';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles;

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

function getCredentialModeLabel(mode?: ImportProviderStatus['credentialMode']) {
  switch (mode) {
    case 'server':
      return appI18n.t('settings.searchProviders.credentialServer');
    case 'user':
      return appI18n.t('settings.searchProviders.credentialUser');
    case 'none':
    default:
      return appI18n.t('settings.searchProviders.credentialNone');
  }
}

function getProviderStatusLabel(status: ImportProviderStatus) {
  if (status.circuitState === 'open') {
    return appI18n.t('settings.searchProviders.statusCircuitOpen');
  }

  if (status.credentialMode === 'none') {
    return appI18n.t('settings.searchProviders.statusAvailable');
  }

  if (status.credentialMode === 'server') {
    return status.configured
      ? appI18n.t('settings.searchProviders.statusAvailable')
      : appI18n.t('settings.searchProviders.statusServerSetupRequired');
  }

  return status.configured
    ? appI18n.t('settings.searchProviders.statusConnected')
    : appI18n.t('settings.searchProviders.statusDisconnected');
}

function getProviderStatusTone(status: ImportProviderStatus) {
  if (status.circuitState === 'open') {
    return 'warning' as const;
  }

  if (status.configured || status.credentialMode === 'none') {
    return 'success' as const;
  }

  return status.credentialMode === 'user'
    ? ('warning' as const)
    : ('muted' as const);
}

function getProviderBenefit(status: ImportProviderStatus) {
  switch (status.provider) {
    case 'aladin':
      return appI18n.t('settings.searchProviders.benefits.aladin');
    case 'tmdb':
      return appI18n.t('settings.searchProviders.benefits.tmdb');
    case 'naver_book':
      return appI18n.t('settings.searchProviders.benefits.naver_book');
    case 'kakao_book':
      return appI18n.t('settings.searchProviders.benefits.kakao_book');
    case 'naver_web':
      return appI18n.t('settings.searchProviders.benefits.naver_web');
    case 'kakao_web':
      return appI18n.t('settings.searchProviders.benefits.kakao_web');
    case 'kobis':
      return appI18n.t('settings.searchProviders.benefits.kobis');
    case 'manual':
      return appI18n.t('settings.searchProviders.benefits.manual');
    case 'anilist':
      return appI18n.t('settings.searchProviders.benefits.anilist');
    case 'google_books':
      return appI18n.t('settings.searchProviders.benefits.google_books');
    case 'open_library':
      return appI18n.t('settings.searchProviders.benefits.open_library');
    case 'tvmaze':
      return appI18n.t('settings.searchProviders.benefits.tvmaze');
    case 'wikidata':
      return appI18n.t('settings.searchProviders.benefits.wikidata');
    case 'brave_search':
      return appI18n.t('settings.searchProviders.benefits.brave_search');
    case 'tavily_search':
      return appI18n.t('settings.searchProviders.benefits.tavily_search');
    default:
      return appI18n.t('settings.searchProviders.benefits.default');
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
          {appI18n.t('settings.searchProviders.circuitOpenDescription')}
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
              {appI18n.t('settings.searchProviders.circuitOpenDescription')}
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
  const { t } = useAppTranslation();

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
    selectedProvider !== null &&
    testingProviderId === selectedProvider.provider;

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.searchProviders.description')}
        eyebrow={t('settings.searchProviders.eyebrow')}
        title={t('settings.searchProviders.title')}
      />

      {mode !== 'authenticated' ? (
        <Stack gap="sm">
          <Text c="dimmed">
            {t('settings.searchProviders.guestDescription')}
          </Text>
          <ActionRow>
            <AppBadge tone="success">
              {t('settings.searchProviders.badgePublicSearch')}
            </AppBadge>
            <AppBadge tone="muted">
              {t('settings.searchProviders.badgeLoginRequired')}
            </AppBadge>
          </ActionRow>
        </Stack>
      ) : isLoadingProviderStatuses ? (
        <Text aria-busy="true" c="dimmed">
          {t('settings.searchProviders.loading')}
        </Text>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <ProviderSummaryCard
              label={t('settings.searchProviders.summaryNoKey')}
              tone="success"
              value={noKeyProviders.length}
            />
            <ProviderSummaryCard
              label={t('settings.searchProviders.summaryConnected')}
              tone="accent"
              value={configuredKeyProviderCount}
            />
            <ProviderSummaryCard
              label={t('settings.searchProviders.summaryAvailable')}
              tone={keyRequiredProviderCount > 0 ? 'warning' : 'muted'}
              value={keyRequiredProviderCount}
            />
          </SimpleGrid>

          <div className={css.providerManagementGrid ?? ''}>
            <Stack gap="md">
              <SectionCard padding="md" tone="subtle">
                <Stack gap="md">
                  <SectionIntro
                    description={t(
                      'settings.searchProviders.keySourcesDescription',
                    )}
                    eyebrow={t('settings.searchProviders.keySourcesEyebrow')}
                    title={t('settings.searchProviders.keySourcesTitle')}
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
                        tone={
                          selectedProvider.configured ? 'success' : 'warning'
                        }
                      >
                        {getProviderStatusLabel(selectedProvider)}
                      </AppBadge>
                    </ActionRow>
                    <Text c="dimmed" size="sm">
                      {getProviderBenefit(selectedProvider)}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {t('settings.searchProviders.supportedTypes', {
                        types: formatMediumTypes(selectedProvider),
                      })}
                    </Text>
                  </Stack>

                  <Box className={css.providerSecurityBox ?? ''}>
                    <Text fw={850} size="sm">
                      {t('settings.searchProviders.securityTitle')}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {t('settings.searchProviders.securityDescription')}
                    </Text>
                  </Box>

                  <Divider />

                  <form onSubmit={handleSubmit}>
                    <Stack gap="sm">
                      {(selectedProvider.credentialFields ?? []).map(
                        (field) => (
                          <TextInput
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            data-1p-ignore="true"
                            data-lpignore="true"
                            description={
                              field.description ??
                              t('settings.searchProviders.fieldDescription')
                            }
                            inputMode="text"
                            key={field.name}
                            label={field.label}
                            name={`provider-credential-${selectedProvider.provider}-${field.name}`}
                            onChange={(event) =>
                              onUpdateCredentialField(
                                field.name,
                                event.currentTarget.value,
                              )
                            }
                            placeholder={t(
                              'settings.searchProviders.fieldPlaceholder',
                              { label: field.label },
                            )}
                            spellCheck={false}
                            type="text"
                            value={credentialDraft[field.name] ?? ''}
                          />
                        ),
                      )}

                      <ActionRow>
                        <AppButton
                          disabled={isDeletingSelected}
                          loading={isSavingSelected}
                          tone="primary"
                          type="submit"
                        >
                          {t('settings.searchProviders.saveKey', {
                            label: selectedLabel,
                          })}
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
                          {t('settings.searchProviders.deleteKey', {
                            label: selectedLabel,
                          })}
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
                          {t('settings.searchProviders.testConnection')}
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
                  {t('settings.searchProviders.noKeyProviders')}
                </Text>
              )}
            </SectionCard>
          </div>

          <details className={css.publicProviderDisclosure ?? ''}>
            <summary className={css.publicProviderSummary ?? ''}>
              <Stack gap={3} miw={0}>
                <Text className={css.publicProviderSummaryTitle ?? ''}>
                  {t('settings.searchProviders.publicTitle')}
                </Text>
                <Text className={css.publicProviderSummaryDescription ?? ''}>
                  {t('settings.searchProviders.publicDescription')}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <AppBadge tone="success">
                  {t('settings.searchProviders.publicCount', {
                    count: formatAppNumber(noKeyProviders.length),
                  })}
                </AppBadge>
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
