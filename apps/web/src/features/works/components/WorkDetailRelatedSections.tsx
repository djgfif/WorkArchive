import { Group, Stack, Text } from '@mantine/core';
import {
  type WorkContributorRole,
  type WorkRecord,
} from '@work-archive/shared-types';

import {
  AppLinkButton,
  PageSection,
  SectionCard,
} from '@shared/components/AppPrimitives';
import type { WorkGraphSnapshot } from '../services/graph.repository';
import type { RelatedCatalogTitlesResponse } from '../services/user-records.api';
import { getSeriesTagValues } from '../utils/graph-tags';
import { getWorkTypeLabel } from '../utils/work-options';
import { useAppTranslation, appI18n } from '@app/i18n';

const relationTypeLabels: Record<string, string> = {
  adaptation: appI18n.t('works.detail.relationAdaptation'),
  alternate_version: appI18n.t('works.detail.relationAlternateVersion'),
  compilation: appI18n.t('works.detail.relationCompilation'),
  original: appI18n.t('works.detail.relationOriginal'),
  prequel: appI18n.t('works.detail.relationPrequel'),
  remake: appI18n.t('works.detail.relationRemake'),
  sequel: appI18n.t('works.detail.relationSequel'),
  side_story: appI18n.t('works.detail.relationSideStory'),
  spin_off: appI18n.t('works.detail.relationSpinOff'),
};

const relatedContributorRoles = new Set<WorkContributorRole>([
  'original_creator',
  'studio',
]);

const contributorRoleLabels: Partial<Record<WorkContributorRole, string>> = {
  original_creator: appI18n.t('works.detail.contributorOriginalCreator'),
  studio: appI18n.t('works.detail.contributorStudio'),
};

function getContributorRoleLabel(role: WorkContributorRole) {
  return contributorRoleLabels[role] ?? role;
}

export function LocalSeriesSection({
  currentWork,
  graph,
  works,
}: {
  currentWork: WorkRecord;
  graph: WorkGraphSnapshot | null;
  works: WorkRecord[];
}) {
  const { t } = useAppTranslation();
  const seriesById = new Map(
    graph?.series.map((series) => [series.id, series]) ?? [],
  );
  const currentSeriesIds = new Set(
    graph?.workSeriesLinks
      .filter((link) => link.workId === currentWork.id)
      .map((link) => link.seriesId) ?? [],
  );
  const seriesValues =
    currentSeriesIds.size > 0
      ? Array.from(currentSeriesIds)
          .map((seriesId) => seriesById.get(seriesId)?.title ?? '')
          .filter(Boolean)
      : getSeriesTagValues(currentWork.personalTags);

  if (seriesValues.length === 0) {
    return null;
  }

  const sameSeriesWorks =
    currentSeriesIds.size > 0 && graph
      ? works
          .filter((work) => work.id !== currentWork.id)
          .filter((work) =>
            graph.workSeriesLinks.some(
              (link) =>
                link.workId === work.id && currentSeriesIds.has(link.seriesId),
            ),
          )
          .sort((left, right) => left.title.localeCompare(right.title))
          .slice(0, 8)
      : (() => {
          const normalizedSeriesValues = new Set(
            seriesValues.map((value) => value.trim().toLowerCase()),
          );

          return works
            .filter((work) => work.id !== currentWork.id)
            .filter((work) =>
              getSeriesTagValues(work.personalTags).some((value) =>
                normalizedSeriesValues.has(value.trim().toLowerCase()),
              ),
            )
            .sort((left, right) => left.title.localeCompare(right.title))
            .slice(0, 8);
        })();

  if (sameSeriesWorks.length === 0) {
    return null;
  }

  return (
    <PageSection
      description={t('works.detail.relatedSeriesDescription')}
      eyebrow={t('works.detail.relatedSeriesEyebrow')}
      title={t('works.detail.relatedSeriesTitle')}
    >
      <Stack gap="md">
        {sameSeriesWorks.map((work) => (
          <SectionCard key={work.id} gap="xs" padding="lg" tone="subtle">
            <Group justify="space-between">
              <Stack gap={4}>
                <Text fw={700}>{work.title}</Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {getWorkTypeLabel(work.type)}
                  {work.rating !== null ? ` · ★ ${work.rating.toFixed(1)}` : ''}
                </Text>
              </Stack>
              <AppLinkButton to={`/works/${work.id}`} tone="quiet">
                {t('works.detail.relatedView')}
              </AppLinkButton>
            </Group>
          </SectionCard>
        ))}
      </Stack>
    </PageSection>
  );
}

export function LocalContributorSection({
  currentWork,
  graph,
  works,
}: {
  currentWork: WorkRecord;
  graph: WorkGraphSnapshot | null;
  works: WorkRecord[];
}) {
  const { t } = useAppTranslation();
  if (!graph) {
    return null;
  }

  const contributorsById = new Map(
    graph.contributors.map((contributor) => [contributor.id, contributor]),
  );
  const currentContributorIds = new Set(
    graph.workContributors
      .filter((link) => link.workId === currentWork.id)
      .filter((link) => relatedContributorRoles.has(link.role))
      .map((link) => link.contributorId),
  );

  if (currentContributorIds.size === 0) {
    return null;
  }

  const relatedWorks = works
    .filter((work) => work.id !== currentWork.id)
    .map((work) => {
      const sharedLinks = graph.workContributors.filter(
        (link) =>
          link.workId === work.id &&
          currentContributorIds.has(link.contributorId) &&
          relatedContributorRoles.has(link.role),
      );

      if (sharedLinks.length === 0) {
        return null;
      }

      const sharedContributorsById = new Map<string, string>();

      for (const link of sharedLinks) {
        const contributor = contributorsById.get(link.contributorId);

        if (!contributor || sharedContributorsById.has(link.contributorId)) {
          continue;
        }

        sharedContributorsById.set(
          link.contributorId,
          `${getContributorRoleLabel(link.role)}: ${contributor.name}`,
        );
      }

      const sharedContributors = Array.from(sharedContributorsById.values());

      return {
        sharedContributors,
        work,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        sharedContributors: string[];
        work: WorkRecord;
      } => Boolean(entry),
    )
    .sort((left, right) => left.work.title.localeCompare(right.work.title))
    .slice(0, 6);

  if (relatedWorks.length === 0) {
    return null;
  }

  return (
    <PageSection
      description={t('works.detail.relatedContributorsDescription')}
      eyebrow={t('works.detail.relatedContributorsEyebrow')}
      title={t('works.detail.relatedContributorsTitle')}
    >
      <Stack gap="md">
        {relatedWorks.map(({ sharedContributors, work }) => (
          <SectionCard key={work.id} gap="xs" padding="lg" tone="subtle">
            <Group justify="space-between">
              <Stack gap={4}>
                <Text fw={700}>{work.title}</Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {getWorkTypeLabel(work.type)}
                  {work.rating !== null ? ` · ★ ${work.rating.toFixed(1)}` : ''}
                </Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {sharedContributors.join(' · ')}
                </Text>
              </Stack>
              <AppLinkButton to={`/works/${work.id}`} tone="quiet">
                {t('works.detail.relatedView')}
              </AppLinkButton>
            </Group>
          </SectionCard>
        ))}
      </Stack>
    </PageSection>
  );
}

export function RelatedTitlesSection({
  relatedData,
}: {
  relatedData: RelatedCatalogTitlesResponse | null;
}) {
  const { t } = useAppTranslation();
  if (!relatedData) {
    return null;
  }

  const seenTitleIds = new Set<string>();
  const relatedEntries = [
    ...relatedData.sameFranchiseTitles.map((title) => {
      seenTitleIds.add(title.id);

      return {
        relationDirection: title.relationDirection ?? null,
        relationType: title.relationType ?? null,
        targetTitle: title,
      };
    }),
    ...relatedData.relations
      .map((relation) => ({
        relationDirection: relation.relationDirection,
        relationType: relation.relationType,
        targetTitle: relation.targetTitle,
      }))
      .filter((title) => {
        if (seenTitleIds.has(title.targetTitle.id)) {
          return false;
        }

        seenTitleIds.add(title.targetTitle.id);

        return true;
      }),
  ];

  if (relatedEntries.length === 0) {
    return null;
  }

  return (
    <PageSection
      description={t('works.detail.relatedCatalogDescription')}
      eyebrow={t('works.detail.relatedCatalogEyebrow')}
      title={t('works.detail.relatedCatalogTitle')}
    >
      <Stack gap="md">
        {relatedEntries.map((relation) => (
          <SectionCard
            key={relation.targetTitle.id}
            gap="xs"
            padding="lg"
            tone="subtle"
          >
            <Group justify="space-between">
              <Text fw={700}>{relation.targetTitle.title}</Text>
              {relation.relationType ? (
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {relationTypeLabels[relation.relationType] ??
                    relation.relationType}
                </Text>
              ) : null}
            </Group>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {getWorkTypeLabel(relation.targetTitle.mediumType)}
              {relation.targetTitle.subType
                ? ` · ${relation.targetTitle.subType}`
                : ''}
              {relation.targetTitle.releaseYear
                ? ` · ${relation.targetTitle.releaseYear}`
                : ''}
            </Text>
          </SectionCard>
        ))}
      </Stack>
    </PageSection>
  );
}
