import { Group, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import type { FormEvent } from 'react';

import { useAppTranslation } from '@app/i18n';
import type { ImportCandidate } from '@features/imports';
import { ArtworkPoster } from '@shared/components/ArtworkPoster';
import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import { PersonalRecordStatusRatingFields } from './PersonalRecordFields';
import {
  getCandidateContributorText,
  getCandidateSourceCoverage,
} from './quick-add-helpers';
import type { WorkFormValues } from '../utils/work-form';
import { getWorkTypeLabel } from '../utils/work-options';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface AddWorkSelectedCandidatePanelProps {
  candidate: ImportCandidate;
  duplicateMatches: WorkRecord[];
  isSubmitting: boolean;
  onEditDetails: () => void;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitError: string | null;
  validationError: string | null;
  values: WorkFormValues;
}

export function AddWorkSelectedCandidatePanel({
  candidate,
  duplicateMatches,
  isSubmitting,
  onEditDetails,
  onRatingChange,
  onStatusChange,
  onSubmit,
  submitError,
  validationError,
  values,
}: AddWorkSelectedCandidatePanelProps) {
  const { t } = useAppTranslation();
  const sourceCoverage = getCandidateSourceCoverage(candidate);

  return (
    <form className={cn(css.selectedCandidateForm)} onSubmit={onSubmit}>
      <Stack gap="lg">
        <Group align="center" justify="space-between" wrap="nowrap">
          <Text className={cn(css.selectedCandidateLabel)}>
            {t('works.add.search.selectedWork')}
          </Text>
          <AppButton
            aria-label={t('works.add.search.applyCandidate')}
            onClick={onEditDetails}
            size="compact-sm"
            tone="quiet"
            type="button"
          >
            {t('works.add.search.editDetails')}
          </AppButton>
        </Group>

        <div className={cn(css.selectedCandidateIdentity)}>
          <ArtworkPoster
            className={cn(css.selectedCandidatePoster)}
            thumbnailUrl={candidate.thumbnailUrl}
            title={candidate.title}
            typeLabel={getWorkTypeLabel(candidate.type)}
            variant="form"
          />
          <Stack gap={7} miw={0}>
            <Title className={cn(css.selectedCandidateTitle)} order={3}>
              {candidate.title}
            </Title>
            <Text c="var(--app-text-secondary)" lineClamp={2} size="sm">
              {getCandidateContributorText(candidate)}
            </Text>
            <Group gap={6} wrap="wrap">
              <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
              {candidate.releaseYear && (
                <AppBadge tone="muted">{candidate.releaseYear}</AppBadge>
              )}
              <AppBadge tone="muted">{candidate.formatLabel}</AppBadge>
            </Group>
            <Text c="var(--app-text-muted)" lineClamp={2} size="xs">
              {sourceCoverage.providerLabels.join(' · ')} ·{' '}
              {sourceCoverage.summaryLabel}
            </Text>
          </Stack>
        </div>

        <div className={cn(css.selectedCandidateRecord)}>
          <PersonalRecordStatusRatingFields
            onRatingChange={onRatingChange}
            onStatusChange={onStatusChange}
            values={values}
          />
        </div>

        {duplicateMatches.length > 0 && (
          <FeedbackMessage tone="info">
            <Stack gap="xs">
              <Text fw={750} size="sm">
                {t('works.add.search.duplicateTitle')}
              </Text>
              <Text c="inherit" size="sm">
                {t('works.add.search.duplicateDescription')}
              </Text>
              {duplicateMatches.map((work) =>
                work.deletedAt === null ? (
                  <AppLinkButton key={work.id} to={`/works/${work.id}`} tone="quiet">
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
          </FeedbackMessage>
        )}

        {(validationError || submitError) && (
          <FeedbackMessage tone="error">
            {validationError ?? submitError}
          </FeedbackMessage>
        )}

        <Stack gap={6}>
          <AppButton
            disabled={isSubmitting}
            fullWidth
            size="lg"
            tone="primary"
            type="submit"
          >
            {isSubmitting ? t('works.form.saving') : t('works.add.save.submit')}
          </AppButton>
          <Text c="var(--app-text-muted)" size="xs" ta="center">
            {t('works.add.search.saveHint')}
          </Text>
        </Stack>
      </Stack>
    </form>
  );
}
