import { SimpleGrid, Stack, TagsInput } from '@mantine/core';

import type { WorkFormListFieldName } from './add-work-form.types';
import type { getWorkMediaFieldLabels } from '../utils/work-media-labels';

interface WorkFormContributorStepProps {
  creatorValues: string[];
  mediaLabels: ReturnType<typeof getWorkMediaFieldLabels>;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  platformValues: string[];
  publisherValues: string[];
  shouldShowStudioField: boolean;
  studioValues: string[];
  uniqueOrganizationSuggestions: string[];
  uniquePersonSuggestions: string[];
}

export function WorkFormContributorStep({
  creatorValues,
  mediaLabels,
  onTextListChange,
  platformValues,
  publisherValues,
  shouldShowStudioField,
  studioValues,
  uniqueOrganizationSuggestions,
  uniquePersonSuggestions,
}: WorkFormContributorStepProps) {
  return (
    <Stack gap="lg" pt="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TagsInput
          clearable
          data={uniquePersonSuggestions}
          id="creatorText"
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
            id="studioText"
            label={mediaLabels.studioLabel}
            name="studioText"
            onChange={(items) => onTextListChange('studioText', items)}
            placeholder={mediaLabels.studioPlaceholder}
            splitChars={[',']}
            value={studioValues}
          />
        )}
        <TagsInput
          clearable
          data={uniqueOrganizationSuggestions}
          id="publisherText"
          label={mediaLabels.publisherLabel}
          name="publisherText"
          onChange={(items) => onTextListChange('publisherText', items)}
          placeholder={mediaLabels.publisherPlaceholder}
          splitChars={[',']}
          value={publisherValues}
        />
        <TagsInput
          clearable
          data={uniqueOrganizationSuggestions}
          id="platformText"
          label={mediaLabels.platformLabel}
          name="platformText"
          onChange={(items) => onTextListChange('platformText', items)}
          placeholder={mediaLabels.platformPlaceholder}
          splitChars={[',']}
          value={platformValues}
        />
      </SimpleGrid>
    </Stack>
  );
}
