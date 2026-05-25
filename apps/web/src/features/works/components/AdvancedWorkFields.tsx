import {
  Accordion,
  Checkbox,
  Paper,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { useEffect, useState } from 'react';

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

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface AdvancedWorkFieldsProps
  extends WorkFormSuggestionProps,
    WorkFormValuesProps {
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
  const uniqueTagSuggestions = Array.from(new Set(tagSuggestions));
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
        <Accordion.Control>상세 정보</Accordion.Control>
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
                  <Text fw={750}>관계 정보</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    시리즈, 세계관처럼 나중에 함께 묶어 볼 연결만 남깁니다.
                  </Text>
                </Stack>

                <Checkbox
                  checked={isSeriesWork}
                  description="후속작, 외전, 리메이크, 공유 세계관을 따로 묶어 탐색할 때 사용합니다."
                  label="시리즈 / 세계관 연결"
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
                  <Text fw={750}>제작 정보</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    작가/제작진과 플랫폼처럼 작품 자체를 찾는 데 필요한 정보를
                    정리합니다.
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
                  <Text fw={750}>내 메모</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    개인 태그, 긴 감상, 설명처럼 내 기준으로 다시 찾을 정보를
                    남깁니다.
                  </Text>
                </Stack>

                <TagsInput
                  clearable
                  data={uniqueTagSuggestions}
                  description="개인 태그: 회귀, 빙의, 이세계처럼 대표 장르에 넣기 어려운 소재와 취향 키워드입니다."
                  id={getFieldId(idPrefix, 'personalTagsText')}
                  label="개인 태그"
                  name="personalTagsText"
                  onChange={(items) =>
                    onTextListChange('personalTagsText', items)
                  }
                  placeholder="시간여행, 다시 볼 것, 여운 강함"
                  splitChars={[',']}
                  value={personalTagValues}
                />

                <Textarea
                  id={getFieldId(idPrefix, 'review')}
                  label="상세 감상"
                  name="review"
                  onChange={onInputChange}
                  placeholder="긴 감상은 저장 후 상세 화면에서 이어서 다듬을 수 있습니다"
                  rows={4}
                  value={values.review}
                />

                <Textarea
                  id={getFieldId(idPrefix, 'description')}
                  label="설명"
                  name="description"
                  onChange={onInputChange}
                  placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
                  rows={4}
                  value={values.description}
                />

                <Checkbox
                  checked={values.favorite}
                  label="즐겨찾기로 표시"
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
