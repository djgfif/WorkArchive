import { NativeSelect, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';

import { ActionRow, AppBadge } from '@shared/components/AppPrimitives';
import { WorkGenreSelector } from './WorkGenreSelector';
import {
  getFieldId,
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
  type WorkFormTitleRefProps,
  type WorkFormValuesProps,
} from './add-work-form.types';
import styles from './ArchiveComponents.module.css';
import { parseCommaSeparatedTextList } from '../utils/work-form';
import { normalizeWorkGenres } from '../utils/work-genres';
import { workTypeOptions } from '../utils/work-options';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface CoreWorkFieldsProps
  extends WorkFormTitleRefProps,
    WorkFormValuesProps {
  error?: string | null;
  idPrefix?: string;
  onChange: WorkFormInputChangeHandler;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
}

export function CoreWorkFields({
  error,
  idPrefix = '',
  onChange,
  onTextListChange,
  titleInputRef,
  values,
}: CoreWorkFieldsProps) {
  const genreValues = normalizeWorkGenres(
    parseCommaSeparatedTextList(values.genresText),
  );

  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">필수</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          제목과 유형만 입력하면 저장할 수 있습니다. 장르는 핵심 분류만
          선택하세요.
        </Text>
      </ActionRow>

      <Stack gap="md">
        <TextInput
          aria-label="제목"
          error={error}
          id={getFieldId(idPrefix, 'title')}
          label="제목"
          name="title"
          onChange={onChange}
          placeholder="작품 제목"
          ref={titleInputRef}
          value={values.title}
          withAsterisk
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <NativeSelect
            id={getFieldId(idPrefix, 'type')}
            label="유형"
            name="type"
            onChange={onChange}
            value={values.type}
          >
            {workTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>

          <Stack className={cn(css.genreTagGuide)} gap={6}>
            <WorkGenreSelector
              description="대표 장르: 판타지, 로맨스처럼 작품의 큰 분류를 3개까지 고릅니다."
              id={getFieldId(idPrefix, 'genresText')}
              onChange={(items) => onTextListChange('genresText', items)}
              value={genreValues}
            />
            <Text c="var(--mantine-color-dimmed)" size="xs">
              개인 태그: 회귀, 빙의, 이세계처럼 내 기준 키워드는 상세 정보의
              내 메모에서 남깁니다.
            </Text>
          </Stack>
        </SimpleGrid>

        <TextInput
          description="비워두면 오른쪽 미리보기에 기본 표지를 사용합니다."
          id={getFieldId(idPrefix, 'thumbnailUrl')}
          label="표지 이미지 주소"
          name="thumbnailUrl"
          onChange={onChange}
          placeholder="https://example.com/cover.jpg"
          value={values.thumbnailUrl}
        />
      </Stack>
    </Stack>
  );
}
