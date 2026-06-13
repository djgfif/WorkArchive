import { useState, type ReactNode } from 'react';
import { Group, Stack, Tabs, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  KeyValueGrid,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { formatWorkDate, formatWorkDateTime } from '../utils/work-options';
import { ReviewNoteCard } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import type { WorkDetailTimelineItem } from '../utils/work-detail-timeline';
import { cn } from '@shared/utils/class-names';

const css = styles;

export interface WorkDetailContributorEntry {
  key: string;
  label: string;
  value: string;
}

interface WorkDetailTabsProps {
  contributorEntries: WorkDetailContributorEntry[];
  contributorValues: string[];
  latestTimelineItem: WorkDetailTimelineItem | null;
  overviewSections?: ReactNode;
  personalTags: string[];
  progressLabel: string | null;
  progressSections?: ReactNode;
  relatedSections?: ReactNode;
  review: string;
  seriesTags: string[];
  shortReview: string;
  sourceIdentityLabel: string;
  statusLabel: string;
  timelinePanel: ReactNode;
  typeLabel: string;
  work: WorkRecord;
}

export function WorkDetailTabs({
  contributorEntries,
  contributorValues,
  latestTimelineItem,
  overviewSections,
  personalTags,
  progressLabel,
  progressSections,
  relatedSections,
  review,
  seriesTags,
  shortReview,
  sourceIdentityLabel,
  statusLabel,
  timelinePanel,
  typeLabel,
  work,
}: WorkDetailTabsProps) {
  const { t } = useAppTranslation();
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  return (
    <Tabs
      classNames={{
        root: cn(css.detailTabs),
        list: cn(css.detailTabsList),
        tab: cn(css.detailTab),
      }}
      keepMounted={false}
      onChange={setActiveTab}
      value={activeTab}
    >
      <Tabs.List>
        <Tabs.Tab value="overview">{t('works.detail.workRecordTab')}</Tabs.Tab>
        <Tabs.Tab value="review">{t('works.detail.reviewTab')}</Tabs.Tab>
        <Tabs.Tab value="progress">{t('works.detail.progressTab')}</Tabs.Tab>
        <Tabs.Tab value="related">{t('works.detail.relatedTab')}</Tabs.Tab>
        <Tabs.Tab value="timeline">{t('works.detail.timelineTab')}</Tabs.Tab>
        <Tabs.Tab value="metadata">{t('works.detail.metadataTab')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview">
        <Stack gap="md">
          <SectionCard padding="md" tone="default">
            <KeyValueGrid
              columns={2}
              items={[
                { label: t('works.detail.type'), value: typeLabel },
                { label: t('works.detail.status'), value: statusLabel },
                {
                  label: t('works.detail.rating'),
                  value:
                    work.rating !== null
                      ? `${work.rating.toFixed(1)} / 5.0`
                      : t('works.ratingMissing'),
                },
                {
                  label: t('works.detail.progress'),
                  value: progressLabel ?? t('works.detail.noProgress'),
                },
                {
                  label: t('works.detail.latestRecord'),
                  value: latestTimelineItem
                    ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.label}`
                    : t('works.detail.timelineEmpty'),
                },
                {
                  label: t('works.detail.shortReviewLabel'),
                  value: shortReview || t('works.detail.shortReviewEmpty'),
                },
              ]}
            />
          </SectionCard>

          {overviewSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="review">
        <Stack gap="md">
          <ReviewNoteCard
            emptyLabel={t('works.detail.shortReviewEmpty')}
            label={t('works.detail.shortReviewLabel')}
            value={shortReview}
          />
          <ReviewNoteCard
            emptyLabel={t('works.detail.detailReviewEmpty')}
            label={t('works.detail.detailReviewLabel')}
            value={review}
          />

          <SectionCard gap="sm" padding="md" tone="subtle">
            <Text c="dimmed" fw={700} mb={6} size="sm">
              {t('works.detail.personalTags')}
            </Text>
            {personalTags.length > 0 ? (
              <Group gap={6} wrap="wrap">
                {personalTags.map((tag) => (
                  <AppBadge key={tag} tone="success">
                    {tag}
                  </AppBadge>
                ))}
              </Group>
            ) : (
              <Text c="dimmed" size="sm">
                {t('works.detail.personalTagsEmpty')}
              </Text>
            )}
          </SectionCard>

          <ActionRow>
            <AppLinkButton
              to={`/works/${work.id}/edit?focus=review`}
              tone="primary"
            >
              {shortReview || review
                ? t('works.detail.editReview')
                : t('works.detail.writeReview')}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
              {t('works.detail.editRecord')}
            </AppLinkButton>
          </ActionRow>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="progress">
        <Stack gap="md">
          <SectionCard gap="md" padding="md" tone="subtle">
            <KeyValueGrid
              columns={2}
              items={[
                { label: t('works.detail.currentStatus'), value: statusLabel },
                {
                  label: t('works.detail.progress'),
                  value: progressLabel ?? t('works.detail.noProgress'),
                },
                {
                  label: t('works.sort.startedAt'),
                  value: formatWorkDate(work.startedAt),
                },
                {
                  label: t('works.sort.completedAt'),
                  value: formatWorkDate(work.completedAt),
                },
                {
                  label: t('works.detail.droppedAt'),
                  value: formatWorkDate(work.droppedAt),
                },
                {
                  label: t('works.detail.latestRecordDate'),
                  value: formatWorkDate(work.lastConsumedAt),
                },
              ]}
            />
          </SectionCard>
          {progressSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="related">
        <Stack gap="md">
          <SectionCard padding="md" tone="subtle">
            <Text c="dimmed" size="sm">
              {t('works.detail.relatedDescription')}
            </Text>
          </SectionCard>
          {relatedSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="timeline">{timelinePanel}</Tabs.Panel>

      <Tabs.Panel value="metadata">
        <Stack gap="md">
          {(seriesTags.length > 0 || contributorValues.length > 0) && (
            <Group gap={6} wrap="wrap">
              {seriesTags.slice(0, 12).map((series) => (
                <AppBadge key={`series-chip-${series}`} tone="accent">
                  {series}
                </AppBadge>
              ))}
              {contributorValues.slice(0, 12).map((contributor) => (
                <AppBadge
                  key={`contributor-chip-${contributor}`}
                  tone="success"
                >
                  {contributor}
                </AppBadge>
              ))}
            </Group>
          )}

          {work.genres.length > 0 && (
            <Group gap={6} wrap="wrap">
              {work.genres.map((genre) => (
                <AppBadge key={genre} tone="accent">
                  {genre}
                </AppBadge>
              ))}
            </Group>
          )}

          <SectionCard gap="lg" padding="lg" tone="subtle">
            <KeyValueGrid
              columns={2}
              items={[
                {
                  label: t('works.detail.authorContributor'),
                  value: work.author || t('works.detail.creatorMissing'),
                },
                {
                  label: t('works.detail.genre'),
                  value:
                    work.genres.length > 0
                      ? work.genres.join(', ')
                      : t('works.detail.genreEmpty'),
                },
                {
                  label: t('works.detail.workDescription'),
                  value:
                    work.description.trim() ||
                    t('works.detail.workDescriptionEmpty'),
                },
                {
                  label: t('works.detail.identitySource'),
                  value: sourceIdentityLabel,
                },
                {
                  label: t('works.detail.createdAt'),
                  value: formatWorkDateTime(work.createdAt),
                },
                {
                  label: t('works.detail.updatedAt'),
                  value: formatWorkDateTime(work.updatedAt),
                },
              ]}
            />
          </SectionCard>

          {(seriesTags.length > 0 ||
            contributorEntries.length > 0 ||
            work.author.trim()) && (
            <SectionCard gap="md" padding="lg" tone="subtle">
              <Stack gap="sm">
                <Text c="dimmed" fw={800} size="sm">
                  {t('works.detail.workInfo')}
                </Text>
                {seriesTags.length > 0 && (
                  <Group gap={6} wrap="wrap">
                    {seriesTags.map((series) => (
                      <AppBadge key={`info-series-${series}`} tone="accent">
                        {t('works.detail.seriesPrefix', { series })}
                      </AppBadge>
                    ))}
                  </Group>
                )}
                {contributorEntries.length > 0 ? (
                  <Stack gap={6}>
                    {contributorEntries.map((entry) => (
                      <Text key={entry.key} size="sm">
                        <Text c="dimmed" component="span" fw={700}>
                          {entry.label}
                        </Text>
                        {': '}
                        {entry.value}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm">
                    <Text c="dimmed" component="span" fw={700}>
                      {t('works.detail.creator')}
                    </Text>
                    {': '}
                    {work.author.trim() || t('works.detail.creatorMissing')}
                  </Text>
                )}
              </Stack>
            </SectionCard>
          )}

          <ActionRow>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
              {t('works.detail.editWorkInfo')}
            </AppLinkButton>
          </ActionRow>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
