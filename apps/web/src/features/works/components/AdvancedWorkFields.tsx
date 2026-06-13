import {
  Accordion,
  Box,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { useEffect, useState } from 'react';

import { useAppTranslation } from '@app/i18n';
import {
  getFieldId,
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
  type WorkFormSuggestionProps,
  type WorkFormValuesProps,
} from './add-work-form.types';
import styles from './ArchiveComponents.module.css';
import { parseCommaSeparatedTextList } from '../utils/work-form';
import { getWorkMediaFieldLabels } from '../utils/work-media-labels';
import {
  getPopularWebNovelKeywords,
  getWebNovelKeywords,
} from '../utils/web-novel-keywords';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface AdvancedWorkFieldsProps
  extends WorkFormSuggestionProps, WorkFormValuesProps {
  idPrefix?: string;
  itemValue: string;
  onInputChange: WorkFormInputChangeHandler;
  onSeriesFieldsClear: () => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
}

export function AdvancedWorkFields({
  idPrefix = '',
  itemValue,
  onInputChange,
  onSeriesFieldsClear,
  onTextListChange,
  organizationContributorSuggestions = [],
  personContributorSuggestions = [],
  seriesSuggestions = [],
  tagSuggestions = [],
  values,
}: AdvancedWorkFieldsProps) {
  const { t } = useAppTranslation();
  const seriesValues = parseCommaSeparatedTextList(values.seriesText);
  const universeValues = parseCommaSeparatedTextList(values.universeText);
  const creatorValues = parseCommaSeparatedTextList(values.creatorText);
  const studioValues = parseCommaSeparatedTextList(values.studioText);
  const publisherValues = parseCommaSeparatedTextList(values.publisherText);
  const platformValues = parseCommaSeparatedTextList(values.platformText);
  const personalTagValues = parseCommaSeparatedTextList(
    values.personalTagsText,
  );
  const uniqueOrganizationSuggestions = Array.from(
    new Set(organizationContributorSuggestions),
  );
  const uniquePersonSuggestions = Array.from(
    new Set(personContributorSuggestions),
  );
  const uniqueSeriesSuggestions = Array.from(new Set(seriesSuggestions));
  const webNovelKeywords = getWebNovelKeywords();
  const popularWebNovelKeywords = getPopularWebNovelKeywords();
  const uniqueTagSuggestions = Array.from(
    new Set([...tagSuggestions, ...webNovelKeywords]),
  );
  const remainingPopularKeywords = popularWebNovelKeywords.filter(
    (keyword) => !personalTagValues.includes(keyword),
  );
  const hasSeriesRelation =
    values.seriesText.trim() !== '' || values.universeText.trim() !== '';
  const [isSeriesWork, setIsSeriesWork] = useState(hasSeriesRelation);
  const mediaLabels = getWorkMediaFieldLabels(values.type);
  const shouldShowStudioField =
    mediaLabels.showStudioField || studioValues.length > 0;

  useEffect(() => {
    if (hasSeriesRelation) {
      setIsSeriesWork(true);
    }
  }, [hasSeriesRelation]);

  return (
    <Accordion>
      <Accordion.Item value={itemValue}>
        <Accordion.Control>{t('works.form.advancedTitle')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md" pt="sm">
            <Paper
              className={cn(css.advancedFieldGroup)}
              p="md"
              radius="md"
              withBorder
            >
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text fw={750}>{t('works.form.relationTitle')}</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    {t('works.form.relationDescription')}
                  </Text>
                </Stack>

                <Checkbox
                  checked={isSeriesWork}
                  description={t('works.form.relationCheckboxDescription')}
                  label={t('works.form.relationCheckboxLabel')}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setIsSeriesWork(checked);

                    if (!checked) {
                      onSeriesFieldsClear();
                    }
                  }}
                />

                {isSeriesWork && (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <TagsInput
                      clearable
                      data={uniqueSeriesSuggestions}
                      description={mediaLabels.seriesDescription}
                      id={getFieldId(idPrefix, 'seriesText')}
                      label={mediaLabels.seriesLabel}
                      name="seriesText"
                      onChange={(items) =>
                        onTextListChange('seriesText', items)
                      }
                      placeholder={mediaLabels.seriesPlaceholder}
                      splitChars={[',']}
                      value={seriesValues}
                    />
                    <TagsInput
                      clearable
                      data={uniqueSeriesSuggestions}
                      description={mediaLabels.universeDescription}
                      id={getFieldId(idPrefix, 'universeText')}
                      label={mediaLabels.universeLabel}
                      name="universeText"
                      onChange={(items) =>
                        onTextListChange('universeText', items)
                      }
                      placeholder={mediaLabels.universePlaceholder}
                      splitChars={[',']}
                      value={universeValues}
                    />
                  </SimpleGrid>
                )}
              </Stack>
            </Paper>

            <Paper
              className={cn(css.advancedFieldGroup)}
              p="md"
              radius="md"
              withBorder
            >
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text fw={750}>{t('works.form.creatorSectionTitle')}</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    {t('works.form.creatorSectionDescription')}
                  </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <TagsInput
                    clearable
                    data={uniquePersonSuggestions}
                    id={getFieldId(idPrefix, 'creatorText')}
                    label={mediaLabels.creatorLabel}
                    name="creatorText"
                    onChange={(items) => onTextListChange('creatorText', items)}
                    placeholder={mediaLabels.creatorPlaceholder}
                    splitChars={[',']}
                    value={creatorValues}
                  />
                  {shouldShowStudioField && (
                    <TagsInput
                      clearable
                      data={uniqueOrganizationSuggestions}
                      id={getFieldId(idPrefix, 'studioText')}
                      label={mediaLabels.studioLabel}
                      name="studioText"
                      onChange={(items) =>
                        onTextListChange('studioText', items)
                      }
                      placeholder={mediaLabels.studioPlaceholder}
                      splitChars={[',']}
                      value={studioValues}
                    />
                  )}
                  <TagsInput
                    clearable
                    data={uniqueOrganizationSuggestions}
                    id={getFieldId(idPrefix, 'publisherText')}
                    label={mediaLabels.publisherLabel}
                    name="publisherText"
                    onChange={(items) =>
                      onTextListChange('publisherText', items)
                    }
                    placeholder={mediaLabels.publisherPlaceholder}
                    splitChars={[',']}
                    value={publisherValues}
                  />
                  <TagsInput
                    clearable
                    data={uniqueOrganizationSuggestions}
                    id={getFieldId(idPrefix, 'platformText')}
                    label={mediaLabels.platformLabel}
                    name="platformText"
                    onChange={(items) =>
                      onTextListChange('platformText', items)
                    }
                    placeholder={mediaLabels.platformPlaceholder}
                    splitChars={[',']}
                    value={platformValues}
                  />
                </SimpleGrid>
              </Stack>
            </Paper>

            <Paper
              className={cn(css.advancedFieldGroup)}
              p="md"
              radius="md"
              withBorder
            >
              <Stack gap="md">
                <Stack gap={2}>
                  <Text fw={750}>{t('works.form.personalMemoTitle')}</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    {t('works.form.personalMemoDescription')}
                  </Text>
                </Stack>

                <TagsInput
                  clearable
                  data={uniqueTagSuggestions}
                  description={t('works.form.personalTagsDescription')}
                  id={getFieldId(idPrefix, 'personalTagsText')}
                  label={t('works.form.personalTagsLabel')}
                  name="personalTagsText"
                  onChange={(items) =>
                    onTextListChange('personalTagsText', items)
                  }
                  placeholder={t('works.form.personalTagsPlaceholder')}
                  splitChars={[',']}
                  value={personalTagValues}
                />

                {remainingPopularKeywords.length > 0 && (
                  <Group gap={6} wrap="wrap">
                    <Text c="dimmed" fw={700} size="xs">
                      {t('works.form.recommendedKeywords')}
                    </Text>
                    {remainingPopularKeywords.map((keyword) => (
                      <Box
                        className={cn(css.tagSuggestionChip)}
                        component="button"
                        key={keyword}
                        onClick={() =>
                          onTextListChange('personalTagsText', [
                            ...personalTagValues,
                            keyword,
                          ])
                        }
                        type="button"
                      >
                        + {keyword}
                      </Box>
                    ))}
                  </Group>
                )}

                <Textarea
                  id={getFieldId(idPrefix, 'review')}
                  label={t('works.form.reviewInputLabel')}
                  name="review"
                  onChange={onInputChange}
                  placeholder={t('works.form.detailedReviewPlaceholder')}
                  rows={4}
                  value={values.review}
                />

                <Textarea
                  id={getFieldId(idPrefix, 'description')}
                  label={t('works.form.workDescriptionLabel')}
                  name="description"
                  onChange={onInputChange}
                  placeholder={t('works.form.workDescriptionPlaceholder')}
                  rows={4}
                  value={values.description}
                />

                <Checkbox
                  checked={values.favorite}
                  label={t('works.form.favoriteLabel')}
                  name="favorite"
                  onChange={onInputChange}
                />
              </Stack>
            </Paper>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
