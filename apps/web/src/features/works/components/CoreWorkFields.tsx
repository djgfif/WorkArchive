import {
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
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
import { cn } from '@shared/utils/class-names';

const css = styles;

interface CoreWorkFieldsProps
  extends WorkFormTitleRefProps, WorkFormValuesProps {
  compact?: boolean;
  error?: string | null;
  idPrefix?: string;
  onChange: WorkFormInputChangeHandler;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  showType?: boolean;
}

export function CoreWorkFields({
  compact = false,
  error,
  idPrefix = '',
  onChange,
  onTextListChange,
  showType = true,
  titleInputRef,
  values,
}: CoreWorkFieldsProps) {
  const { t } = useAppTranslation();

  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">{t('works.form.basicRequiredBadge')}</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {t('works.form.basicDescription')}
        </Text>
      </ActionRow>

      <Stack gap="md">
        <TextInput
          aria-label={t('works.form.titleAria')}
          error={error}
          id={getFieldId(idPrefix, 'title')}
          label={t('works.form.titleLabel')}
          name="title"
          onChange={onChange}
          placeholder={t('works.form.titlePlaceholder')}
          ref={titleInputRef}
          value={values.title}
          withAsterisk
        />

        {(showType || !compact) && (
          <SimpleGrid cols={{ base: 1, md: compact ? 1 : 2 }} spacing="md">
            {showType && (
              <NativeSelect
                id={getFieldId(idPrefix, 'type')}
                label={t('works.form.typeLabel')}
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
            )}

            {!compact && (
              <OptionalCoreWorkFields
                idPrefix={idPrefix}
                onChange={onChange}
                onTextListChange={onTextListChange}
                values={values}
              />
            )}
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  );
}

export function OptionalCoreWorkFields({
  idPrefix = '',
  includeType = false,
  onChange,
  onTextListChange,
  values,
}: Pick<
  CoreWorkFieldsProps,
  'idPrefix' | 'onChange' | 'onTextListChange' | 'values'
> & { includeType?: boolean }) {
  const { t } = useAppTranslation();
  const genreValues = normalizeWorkGenres(
    parseCommaSeparatedTextList(values.genresText),
  );

  return (
    <>
      {includeType && (
        <NativeSelect
          id={getFieldId(idPrefix, 'type')}
          label={t('works.form.typeLabel')}
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
      )}
      <Stack className={cn(css.genreTagGuide)} gap={6}>
        <WorkGenreSelector
          id={getFieldId(idPrefix, 'genresText')}
          onChange={(items) => onTextListChange('genresText', items)}
          value={genreValues}
        />
      </Stack>
      <TextInput
        description={t('works.form.thumbnailDescription')}
        id={getFieldId(idPrefix, 'thumbnailUrl')}
        label={t('works.form.thumbnailLabel')}
        name="thumbnailUrl"
        onChange={onChange}
        placeholder="https://example.com/cover.jpg"
        value={values.thumbnailUrl}
      />
    </>
  );
}
