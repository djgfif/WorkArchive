import { Accordion, Alert, SimpleGrid, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppButton,
  ChipSummary,
} from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import type { CandidateSourceCoverage } from './quick-add-helpers';

interface CandidateFieldSummary {
  filled: string[];
  missing: string[];
}

interface ImportedCandidateSummaryProps {
  candidate: ImportCandidate;
  fieldSummary: CandidateFieldSummary;
  onBackToSearch: () => void;
  onReset: () => void;
  sourceCoverage: CandidateSourceCoverage;
}

export function ImportedCandidateSummary({
  candidate,
  fieldSummary,
  onBackToSearch,
  onReset,
  sourceCoverage,
}: ImportedCandidateSummaryProps) {
  const { t } = useAppTranslation();

  return (
    <Alert color="blue" radius="lg" variant="light">
      <Stack gap="sm">
        <ActionRow justify="space-between">
          <AppBadge tone="accent">{t('works.add.imported.title')}</AppBadge>
          <ActionRow>
            <AppButton
              onClick={onBackToSearch}
              size="compact-sm"
              tone="ghost"
              type="button"
            >
              {t('works.add.imported.backToSearch')}
            </AppButton>
            <AppButton
              onClick={onReset}
              size="compact-sm"
              tone="ghost"
              type="button"
            >
              {t('works.add.imported.switchToManual')}
            </AppButton>
          </ActionRow>
        </ActionRow>
        <Text c="inherit" fw={700}>
          {candidate.title}
        </Text>
        <Text c="inherit" lineClamp={2} size="sm">
          {candidate.reason}
        </Text>
        <Text c="inherit" size="sm">
          {t('works.add.imported.description')}
        </Text>
        <ActionRow>
          <AppBadge tone="muted">{sourceCoverage.summaryLabel}</AppBadge>
        </ActionRow>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <ChipSummary
            emptyLabel={t('works.add.imported.emptyFilled')}
            label={t('works.add.imported.filledLabel')}
            values={fieldSummary.filled}
          />
          <ChipSummary
            emptyLabel={t('works.add.imported.emptyMissing')}
            label={t('works.add.imported.missingLabel')}
            values={fieldSummary.missing}
          />
        </SimpleGrid>
        <Accordion variant="contained">
          <Accordion.Item value="source-details">
            <Accordion.Control>
              {t('works.add.imported.sourceDetails')}
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <ActionRow>
                  <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
                  <AppBadge tone="muted">
                    {t('works.add.imported.aliasCount', {
                      count: candidate.titleAliases?.length ?? 0,
                    })}
                  </AppBadge>
                </ActionRow>
                <ActionRow>
                  {sourceCoverage.providerLabels.map((providerLabel) => (
                    <AppBadge key={providerLabel} tone="muted">
                      {providerLabel}
                    </AppBadge>
                  ))}
                </ActionRow>
                <ActionRow>
                  <AppBadge tone="muted">
                    {sourceCoverage.externalIdentityLabel}
                  </AppBadge>
                  <AppBadge tone="muted">
                    {sourceCoverage.releaseCandidateLabel}
                  </AppBadge>
                </ActionRow>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Alert>
  );
}
