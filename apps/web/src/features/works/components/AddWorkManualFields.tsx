import type { ReactNode, RefObject } from 'react';
import { Grid, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import { AdvancedWorkFields } from './AdvancedWorkFields';
import { CoreWorkFields, OptionalCoreWorkFields } from './CoreWorkFields';
import { PersonalRecordFields } from './PersonalRecordFields';
import { QuickCapturePreview } from './QuickCapturePreview';
import {
  type AddWorkSuggestions,
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import type { WorkFormValues } from '../utils/work-form';
import styles from './ArchiveComponents.module.css';

const css = styles;

interface ManualFieldControls {
  onInputChange: WorkFormInputChangeHandler;
  onRatingChange: (rating: number | null) => void;
  onSeriesFieldsClear: () => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  suggestions: AddWorkSuggestions;
  titleError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  values: WorkFormValues;
}

interface AddWorkManualFieldsProps extends ManualFieldControls {
  duplicateCount: number;
  isDialog: boolean;
  primaryActions?: ReactNode;
  sourceLabel: string | null;
}

function CoreFields({
  compact = false,
  onInputChange,
  onTextListChange,
  titleError,
  titleInputRef,
  values,
}: Pick<
  ManualFieldControls,
  | 'onInputChange'
  | 'onTextListChange'
  | 'titleError'
  | 'titleInputRef'
  | 'values'
> & { compact?: boolean }) {
  return (
    <CoreWorkFields
      compact={compact}
      error={titleError}
      idPrefix="manual"
      onChange={onInputChange}
      onTextListChange={onTextListChange}
      titleInputRef={titleInputRef}
      values={values}
    />
  );
}

function PersonalFields({
  onInputChange,
  onRatingChange,
  onStatusChange,
  values,
}: Pick<
  ManualFieldControls,
  'onInputChange' | 'onRatingChange' | 'onStatusChange' | 'values'
>) {
  return (
    <PersonalRecordFields
      idPrefix="manual"
      onInputChange={onInputChange}
      onRatingChange={onRatingChange}
      onStatusChange={onStatusChange}
      values={values}
    />
  );
}

function AdvancedFields({
  onInputChange,
  onSeriesFieldsClear,
  onTextListChange,
  suggestions,
  values,
}: Pick<
  ManualFieldControls,
  | 'onInputChange'
  | 'onSeriesFieldsClear'
  | 'onTextListChange'
  | 'suggestions'
  | 'values'
>) {
  return (
    <AdvancedWorkFields
      idPrefix="manual"
      itemValue="manual-advanced-fields"
      onInputChange={onInputChange}
      onSeriesFieldsClear={onSeriesFieldsClear}
      onTextListChange={onTextListChange}
      organizationContributorSuggestions={
        suggestions.organizationContributorSuggestions
      }
      personContributorSuggestions={suggestions.personContributorSuggestions}
      seriesSuggestions={suggestions.seriesSuggestions}
      tagSuggestions={suggestions.tagSuggestions}
      values={values}
    />
  );
}

function ManualFieldStack(props: ManualFieldControls) {
  return (
    <Stack gap="lg">
      <CoreFields {...props} />
      <PersonalFields {...props} />
      <AdvancedFields {...props} />
    </Stack>
  );
}

function CapturePreview({
  duplicateCount,
  sourceLabel,
  values,
}: Pick<
  AddWorkManualFieldsProps,
  'duplicateCount' | 'sourceLabel' | 'values'
>) {
  return (
    <QuickCapturePreview
      duplicateCount={duplicateCount}
      sourceLabel={sourceLabel}
      values={values}
    />
  );
}

export function AddWorkManualFields({
  duplicateCount,
  isDialog,
  primaryActions,
  sourceLabel,
  ...fieldControls
}: AddWorkManualFieldsProps) {
  const { t } = useAppTranslation();

  if (isDialog) {
    return (
      <Grid align="start" gap="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ManualFieldStack {...fieldControls} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <CapturePreview
            duplicateCount={duplicateCount}
            sourceLabel={sourceLabel}
            values={fieldControls.values}
          />
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <Stack gap="xl">
      <Grid align="start" gap="xl">
        <Grid.Col order={{ base: 1, md: 1 }} span={{ base: 12, md: 8 }}>
          <CoreFields compact {...fieldControls} />
        </Grid.Col>
        {primaryActions && (
          <Grid.Col order={{ base: 2, md: 3 }} span={{ base: 12, md: 8 }}>
            {primaryActions}
          </Grid.Col>
        )}
        <Grid.Col order={{ base: 3, md: 2 }} span={{ base: 12, md: 4 }}>
          <CapturePreview
            duplicateCount={duplicateCount}
            sourceLabel={sourceLabel}
            values={fieldControls.values}
          />
        </Grid.Col>
      </Grid>

      <details className={css.addWorkDisclosure ?? ''}>
        <summary>
          <span>
            <Text component="span" fw={800}>
              {t('works.add.optionalFieldsTitle')}
            </Text>
            <Text c="dimmed" component="span" size="sm">
              {t('works.add.optionalFieldsDescription')}
            </Text>
          </span>
        </summary>
        <Stack gap="xl" mt="lg">
          <OptionalCoreWorkFields
            idPrefix="manual"
            onChange={fieldControls.onInputChange}
            onTextListChange={fieldControls.onTextListChange}
            values={fieldControls.values}
          />
          <PersonalFields {...fieldControls} />
          <AdvancedFields {...fieldControls} />
        </Stack>
      </details>
    </Stack>
  );
}
