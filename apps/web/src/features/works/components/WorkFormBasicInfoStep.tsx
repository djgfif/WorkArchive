import type { ReactNode, RefObject } from 'react';
import {
  Checkbox,
  Grid,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import { SegmentedChoiceGroup } from './ArchiveComponents';
import {
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import { WorkGenreSelector } from './WorkGenreSelector';
import type { WorkFormValues } from '../utils/work-form';
import {
  serialStatusOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface WorkFormBasicInfoStepProps {
  genreValues: string[];
  onInputChange: WorkFormInputChangeHandler;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  onTypeChange: (type: WorkFormValues['type']) => void;
  titleError?: ReactNode;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  values: WorkFormValues;
}

export function WorkFormBasicInfoStep({
  genreValues,
  onInputChange,
  onStatusChange,
  onTextListChange,
  onTypeChange,
  titleError,
  titleInputRef,
  values,
}: WorkFormBasicInfoStepProps) {
  const { t } = useAppTranslation();

  return (
    <Stack gap="lg" pt="md">
      <Grid gap="md">
        <Grid.Col span={12}>
          <TextInput
            aria-label={t('works.form.titleAria')}
            error={titleError}
            id="title"
            label={t('works.form.titleLabel')}
            name="title"
            onChange={onInputChange}
            placeholder={t('works.form.titlePlaceholder')}
            ref={titleInputRef}
            value={values.title}
            withAsterisk
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TextInput
            aria-describedby="thumbnailUrlHint"
            id="thumbnailUrl"
            label={t('works.form.thumbnailLabel')}
            name="thumbnailUrl"
            onChange={onInputChange}
            placeholder="https://example.com/cover.jpg"
            type="url"
            value={values.thumbnailUrl}
          />
          <Text c="dimmed" id="thumbnailUrlHint" mt={4} size="xs">
            {t('works.form.thumbnailFallbackDescription')}
          </Text>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SegmentedChoiceGroup
          aria-label={t('works.form.typeLabel')}
          label={t('works.form.typeLabel')}
          onChange={onTypeChange}
          options={workTypeOptions}
          value={values.type}
        />
        <WorkGenreSelector
          id="genresText"
          onChange={(items) => onTextListChange('genresText', items)}
          value={genreValues}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SegmentedChoiceGroup
          aria-label={t('works.form.statusLabel')}
          label={t('works.form.statusLabel')}
          onChange={onStatusChange}
          options={workStatusOptions}
          value={values.status}
        />
        <NativeSelect
          aria-label={t('works.form.serialStatusLabel')}
          data={[
            { value: '', label: t('works.form.serialStatusUnknown') },
            ...serialStatusOptions,
          ]}
          description={t('works.form.serialStatusDescription')}
          label={t('works.form.serialStatusLabel')}
          name="serialStatus"
          onChange={onInputChange}
          value={values.serialStatus}
        />
      </SimpleGrid>

      <Checkbox
        checked={values.favorite}
        label={t('works.form.favoriteLabel')}
        name="favorite"
        onChange={onInputChange}
      />

      <TextInput
        id="startedAt"
        label={t('works.form.startedAtLabel')}
        name="startedAt"
        onChange={onInputChange}
        type="date"
        value={values.startedAt}
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          id="lastConsumedAt"
          label={t('works.form.lastConsumedAtLabel')}
          name="lastConsumedAt"
          onChange={onInputChange}
          type="date"
          value={values.lastConsumedAt}
        />
        <TextInput
          id="completedAt"
          label={t('works.form.completedAtLabel')}
          name="completedAt"
          onChange={onInputChange}
          type="date"
          value={values.completedAt}
        />
        <TextInput
          id="droppedAt"
          label={t('works.form.droppedAtLabel')}
          name="droppedAt"
          onChange={onInputChange}
          type="date"
          value={values.droppedAt}
        />
      </SimpleGrid>
    </Stack>
  );
}
