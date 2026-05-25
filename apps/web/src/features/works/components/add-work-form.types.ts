import type { ChangeEvent, RefObject } from 'react';

import type { WorkFormValues } from '../utils/work-form';

export type WorkFormInputChangeHandler = (
  event: ChangeEvent<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >,
) => void;

export type WorkFormListFieldName =
  | 'creatorText'
  | 'genresText'
  | 'personalTagsText'
  | 'platformText'
  | 'publisherText'
  | 'seriesText'
  | 'studioText'
  | 'universeText';

export function getFieldId(idPrefix: string, fieldName: string) {
  if (!idPrefix) {
    return fieldName;
  }

  return `${idPrefix}${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
}

export interface WorkFormSuggestionProps {
  organizationContributorSuggestions?: string[];
  personContributorSuggestions?: string[];
  seriesSuggestions?: string[];
  tagSuggestions?: string[];
}

export interface WorkFormTitleRefProps {
  titleInputRef?: RefObject<HTMLInputElement | null>;
}

export interface WorkFormValuesProps {
  values: WorkFormValues;
}
