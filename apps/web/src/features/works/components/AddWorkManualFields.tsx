import type { RefObject } from 'react';
import { Grid, Stack } from '@mantine/core';

import { AdvancedWorkFields } from './AdvancedWorkFields';
import { CoreWorkFields } from './CoreWorkFields';
import { PersonalRecordFields } from './PersonalRecordFields';
import { QuickCapturePreview } from './QuickCapturePreview';
import {
  type AddWorkSuggestions,
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import type { WorkFormValues } from '../utils/work-form';

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
  sourceLabel: string | null;
}

function CoreFields({
  onInputChange,
  onTextListChange,
  titleError,
  titleInputRef,
  values,
}: Pick<
  ManualFieldControls,
  'onInputChange' | 'onTextListChange' | 'titleError' | 'titleInputRef' | 'values'
>) {
  return (
    <CoreWorkFields
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
}: Pick<AddWorkManualFieldsProps, 'duplicateCount' | 'sourceLabel' | 'values'>) {
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
  sourceLabel,
  ...fieldControls
}: AddWorkManualFieldsProps) {
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
        <Grid.Col span={{ base: 12, md: 8 }}>
          <CoreFields {...fieldControls} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <CapturePreview
            duplicateCount={duplicateCount}
            sourceLabel={sourceLabel}
            values={fieldControls.values}
          />
        </Grid.Col>
      </Grid>

      <PersonalFields {...fieldControls} />
      <AdvancedFields {...fieldControls} />
    </Stack>
  );
}
