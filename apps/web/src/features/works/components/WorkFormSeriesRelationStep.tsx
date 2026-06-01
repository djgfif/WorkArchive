import { Checkbox, Paper, SimpleGrid, Stack, TagsInput } from '@mantine/core';

import type { WorkFormListFieldName } from './add-work-form.types';
import type { getWorkMediaFieldLabels } from '../utils/work-media-labels';

interface WorkFormSeriesRelationStepProps {
  isSeriesWork: boolean;
  mediaLabels: ReturnType<typeof getWorkMediaFieldLabels>;
  onSeriesWorkChange: (isSeriesWork: boolean) => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  seriesValues: string[];
  uniqueSeriesSuggestions: string[];
  universeValues: string[];
}

export function WorkFormSeriesRelationStep({
  isSeriesWork,
  mediaLabels,
  onSeriesWorkChange,
  onTextListChange,
  seriesValues,
  uniqueSeriesSuggestions,
  universeValues,
}: WorkFormSeriesRelationStepProps) {
  return (
    <Stack gap="lg" pt="md">
      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <Checkbox
            checked={isSeriesWork}
            description="후속작, 외전, 리메이크, 공유 세계관을 따로 묶어 탐색할 때 사용합니다."
            label="시리즈 / 세계관 연결"
            onChange={(event) =>
              onSeriesWorkChange(event.currentTarget.checked)
            }
          />

          {isSeriesWork && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TagsInput
                clearable
                data={uniqueSeriesSuggestions}
                description={mediaLabels.seriesDescription}
                id="seriesText"
                label={mediaLabels.seriesLabel}
                name="seriesText"
                onChange={(items) => onTextListChange('seriesText', items)}
                placeholder={mediaLabels.seriesPlaceholder}
                splitChars={[',']}
                value={seriesValues}
              />
              <TagsInput
                clearable
                data={uniqueSeriesSuggestions}
                description={mediaLabels.universeDescription}
                id="universeText"
                label={mediaLabels.universeLabel}
                name="universeText"
                onChange={(items) => onTextListChange('universeText', items)}
                placeholder={mediaLabels.universePlaceholder}
                splitChars={[',']}
                value={universeValues}
              />
            </SimpleGrid>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
