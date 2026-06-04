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
  return (
    <Stack gap="lg" pt="md">
      <Grid gap="md">
        <Grid.Col span={12}>
          <TextInput
            aria-label="제목"
            error={titleError}
            id="title"
            label="제목"
            name="title"
            onChange={onInputChange}
            placeholder="작품 제목"
            ref={titleInputRef}
            value={values.title}
            withAsterisk
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TextInput
            aria-describedby="thumbnailUrlHint"
            id="thumbnailUrl"
            label="표지 이미지 주소"
            name="thumbnailUrl"
            onChange={onInputChange}
            placeholder="https://example.com/cover.jpg"
            type="url"
            value={values.thumbnailUrl}
          />
          <Text c="dimmed" id="thumbnailUrlHint" mt={4} size="xs">
            표지가 없으면 fallback 커버로 표시됩니다.
          </Text>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SegmentedChoiceGroup
          aria-label="작품 유형"
          label="유형"
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
          aria-label="작품 상태"
          label="상태"
          onChange={onStatusChange}
          options={workStatusOptions}
          value={values.status}
        />
        <NativeSelect
          aria-label="연재 상태"
          data={[{ value: '', label: '미정' }, ...serialStatusOptions]}
          description="작품 자체의 공급 상태 (완결/연재 중/휴재)"
          label="연재 상태"
          name="serialStatus"
          onChange={onInputChange}
          value={values.serialStatus}
        />
      </SimpleGrid>

      <Checkbox
        checked={values.favorite}
        label="즐겨찾기로 표시"
        name="favorite"
        onChange={onInputChange}
      />

      <TextInput
        id="startedAt"
        label="시작일"
        name="startedAt"
        onChange={onInputChange}
        type="date"
        value={values.startedAt}
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          id="lastConsumedAt"
          label="마지막 감상일"
          name="lastConsumedAt"
          onChange={onInputChange}
          type="date"
          value={values.lastConsumedAt}
        />
        <TextInput
          id="completedAt"
          label="완료일"
          name="completedAt"
          onChange={onInputChange}
          type="date"
          value={values.completedAt}
        />
        <TextInput
          id="droppedAt"
          label="하차일"
          name="droppedAt"
          onChange={onInputChange}
          type="date"
          value={values.droppedAt}
        />
      </SimpleGrid>
    </Stack>
  );
}
