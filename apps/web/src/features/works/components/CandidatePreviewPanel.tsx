import {
  Accordion,
  Alert,
  Anchor,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  MetricPill,
} from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
  hasWikidataSource,
  isPreviewOrManualCandidate,
} from './quick-add-helpers';
import { getWorkTypeLabel } from '../utils/work-options';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface CandidatePreviewPanelProps {
  candidate: ImportCandidate;
  duplicateMatches: WorkRecord[];
  onApply: () => void;
}

function formatExternalIdentityLabel(
  ref: ImportCandidate['externalRefs'][number],
) {
  return [ref.provider, ref.rawType, ref.externalId]
    .filter(Boolean)
    .join(' · ');
}

function getTitleSourceLabel(
  candidate: ImportCandidate,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  if (isPreviewOrManualCandidate(candidate)) {
    return t('works.add.search.titleSourceManual');
  }

  const aliasCount = candidate.titleAliases?.filter(
    (titleAlias) => titleAlias !== candidate.title,
  ).length;

  return aliasCount && aliasCount > 0
    ? t('works.add.search.titleSourceAliases', { count: aliasCount })
    : t('works.add.search.titleSourceOnly');
}

export function CandidatePreviewPanel({
  candidate,
  duplicateMatches,
  onApply,
}: CandidatePreviewPanelProps) {
  const { t } = useAppTranslation();
  const sourceCoverage = getCandidateSourceCoverage(candidate);
  const isManualCandidate = isPreviewOrManualCandidate(candidate);
  const scoreBreakdown = isManualCandidate
    ? []
    : candidate.scoreBreakdown?.filter((entry) => entry.weight > 0).slice(0, 3);
  const titleAliases = candidate.titleAliases?.filter(
    (titleAlias) => titleAlias !== candidate.title,
  );
  const needsManualReview = !isManualCandidate && candidate.confidence < 0.62;
  const wikidataIncluded = hasWikidataSource(candidate);
  const externalIdentityLabels = candidate.externalRefs
    .map(formatExternalIdentityLabel)
    .slice(0, 3);
  const providerLabels = sourceCoverage.providerLabels.slice(0, 3);
  const hiddenProviderCount =
    sourceCoverage.providerLabels.length - providerLabels.length;

  return (
    <Stack gap="lg">
      <Group align="flex-start" gap="lg" wrap="wrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="detail"
        />

        <Stack flex={1} gap="md" miw={0}>
          <Stack gap="xs">
            <ActionRow>
              <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
              {isManualCandidate ? (
                <AppBadge tone="accent">
                  {t('works.add.search.manualCandidate')}
                </AppBadge>
              ) : (
                <>
                  <AppBadge tone="success">
                    {candidate.confidenceLabel}
                  </AppBadge>
                  <AppBadge tone="muted">{candidate.sourceLabel}</AppBadge>
                  {wikidataIncluded && (
                    <AppBadge tone="accent">
                      {candidate.sourceId === 'wikidata'
                        ? t('works.add.search.wikidataIncluded')
                        : t('works.add.search.wikidataEnhanced')}
                    </AppBadge>
                  )}
                </>
              )}
              {!isManualCandidate && candidate.catalogMatch && (
                <AppBadge tone="success">
                  {t('works.add.search.catalogMatch')}
                </AppBadge>
              )}
            </ActionRow>

            <div>
              <Title order={3}>{candidate.title}</Title>
              <Text c="var(--mantine-color-dimmed)" size="sm">
                {getCandidateContributorText(candidate)}
              </Text>
            </div>
          </Stack>

          <Text c="var(--mantine-color-text)" lh={1.7}>
            {candidate.description || t('works.add.search.descriptionEmpty')}
          </Text>

          <ActionRow>
            <MetricPill
              label={
                isManualCandidate
                  ? t('works.add.search.inputMode')
                  : t('works.add.search.searchSource')
              }
              value={
                isManualCandidate
                  ? t('works.add.search.manualRecord')
                  : sourceCoverage.summaryLabel
              }
            />
            <MetricPill
              label={t('works.add.search.format')}
              value={candidate.formatLabel}
            />
            <MetricPill
              label={t('works.add.search.titleEvidence')}
              value={getTitleSourceLabel(candidate, t)}
            />
          </ActionRow>

          {titleAliases && titleAliases.length > 0 && (
            <ActionRow>
              {titleAliases.slice(0, 4).map((titleAlias) => (
                <AppBadge key={titleAlias} tone="muted">
                  {titleAlias}
                </AppBadge>
              ))}
            </ActionRow>
          )}

          {!isManualCandidate && candidate.relationsHint.length > 0 && (
            <ActionRow>
              {candidate.relationsHint.slice(0, 4).map((relation) => (
                <AppBadge
                  key={`${relation.relationType}:${relation.targetTitle}`}
                  tone="muted"
                >
                  {relation.relationType}: {relation.targetTitle}
                </AppBadge>
              ))}
            </ActionRow>
          )}
        </Stack>
      </Group>

      <Paper
        className={cn(css.searchEvidencePanel)}
        p="md"
        radius="md"
        withBorder
      >
        <Stack gap="sm">
          <Text c="var(--mantine-color-dimmed)" fw={700} size="sm">
            {isManualCandidate
              ? t('works.add.search.directGuide')
              : t('works.add.search.searchEvidence')}
          </Text>
          <Text c="var(--mantine-color-text)" lineClamp={3} size="sm">
            {isManualCandidate
              ? t('works.add.search.directGuideBody')
              : candidate.reason}
          </Text>
          {!isManualCandidate && candidate.note && (
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {candidate.note}
            </Text>
          )}
          <ActionRow>
            {!isManualCandidate && (
              <>
                <AppBadge tone="muted">
                  {sourceCoverage.externalIdentityLabel}
                </AppBadge>
                <AppBadge tone="muted">
                  {sourceCoverage.releaseCandidateLabel}
                </AppBadge>
              </>
            )}
            {candidate.existingRecord && (
              <AppBadge tone="warning">
                {t('works.add.search.alreadyInRecord')}
              </AppBadge>
            )}
          </ActionRow>
          {!isManualCandidate && (
            <ActionRow>
              {providerLabels.map((providerLabel) => (
                <AppBadge key={providerLabel} tone="muted">
                  {providerLabel}
                </AppBadge>
              ))}
              {hiddenProviderCount > 0 && (
                <AppBadge tone="muted">
                  {t('works.add.search.moreSources', {
                    count: hiddenProviderCount,
                  })}
                </AppBadge>
              )}
            </ActionRow>
          )}
          {!isManualCandidate && externalIdentityLabels.length > 0 && (
            <Accordion
              className={cn(css.compactEvidenceAccordion)}
              variant="contained"
            >
              <Accordion.Item value="external-identity">
                <Accordion.Control>
                  {t('works.add.search.externalIdentityShow')}
                </Accordion.Control>
                <Accordion.Panel>
                  <ActionRow>
                    {externalIdentityLabels.map((identityLabel) => (
                      <AppBadge key={identityLabel} tone="muted">
                        {identityLabel}
                      </AppBadge>
                    ))}
                  </ActionRow>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
          {scoreBreakdown && scoreBreakdown.length > 0 && (
            <ActionRow>
              {scoreBreakdown.map((entry) => (
                <AppBadge key={`${entry.label}:${entry.weight}`} tone="success">
                  {entry.label}
                </AppBadge>
              ))}
            </ActionRow>
          )}
          {!isManualCandidate && candidate.sourceUrl && (
            <ActionRow>
              <Anchor
                href={candidate.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t('works.add.search.sourcePageOpen')}
              </Anchor>
            </ActionRow>
          )}
        </Stack>
      </Paper>

      {needsManualReview && (
        <Alert
          color="yellow"
          radius="md"
          title={t('works.add.search.manualReviewTitle')}
          variant="light"
        >
          <Text c="inherit" size="sm">
            {t('works.add.search.manualReviewDescription')}
          </Text>
        </Alert>
      )}

      {duplicateMatches.length > 0 && (
        <Alert
          color="blue"
          radius="md"
          title={t('works.add.search.duplicateTitle')}
          variant="light"
        >
          <Stack gap="sm">
            <Text c="inherit" size="sm">
              {t('works.add.search.duplicateDescription')}
            </Text>
            {duplicateMatches.map((work) =>
              work.deletedAt === null ? (
                <AppLinkButton
                  key={work.id}
                  to={`/works/${work.id}`}
                  tone="quiet"
                >
                  {work.title}
                </AppLinkButton>
              ) : (
                <AppLinkButton
                  key={work.id}
                  to={`/works?scope=trash&q=${encodeURIComponent(work.title)}`}
                  tone="quiet"
                >
                  {t('works.add.search.viewInTrash', { title: work.title })}
                </AppLinkButton>
              ),
            )}
          </Stack>
        </Alert>
      )}

      <ActionRow justify="space-between">
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {t('works.add.search.applyDescription')}
        </Text>
        <AppButton onClick={onApply} tone="primary" type="button">
          {isManualCandidate
            ? t('works.add.search.applyManual')
            : t('works.add.search.applyCandidate')}
        </AppButton>
      </ActionRow>
    </Stack>
  );
}
