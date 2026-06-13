import { useState } from 'react';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  MAX_WORK_GENRES,
  WORK_GENRES,
  type WorkGenreValue,
} from '../utils/work-genres';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorkGenreSelectorProps {
  description?: string;
  id?: string;
  label?: string;
  onChange: (genres: WorkGenreValue[]) => void;
  value: string[];
}

export function WorkGenreSelector({
  description,
  id = 'workGenreSelector',
  label,
  onChange,
  value,
}: WorkGenreSelectorProps) {
  const { t } = useAppTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const selectedGenres = new Set(value);
  const labelId = `${id}Label`;
  const fieldLabel = label ?? t('works.detail.genre');
  const selectedLabel =
    value.length > 0 ? value.join(', ') : t('works.form.genreSelect');
  const helperText =
    value.length >= MAX_WORK_GENRES
      ? t('works.form.genreLimitDescription')
      : description;
  const descriptionId = helperText ? `${id}Description` : undefined;

  function toggleGenre(genre: WorkGenreValue) {
    if (!selectedGenres.has(genre) && value.length >= MAX_WORK_GENRES) {
      return;
    }

    const nextGenres = selectedGenres.has(genre)
      ? WORK_GENRES.filter(
          (candidate) => candidate !== genre && selectedGenres.has(candidate),
        )
      : WORK_GENRES.filter(
          (candidate) => candidate === genre || selectedGenres.has(candidate),
        );

    onChange(nextGenres);
  }

  return (
    <Stack gap={6}>
      <Group align="baseline" justify="space-between" wrap="nowrap">
        <Text
          fw={600}
          id={labelId}
          size="sm"
          style={{ color: 'var(--app-text-secondary)' }}
        >
          {fieldLabel}
        </Text>
        <Text c="dimmed" size="xs">
          {value.length} / {MAX_WORK_GENRES}
        </Text>
      </Group>
      <Box className={cn(css.genreFloatingPicker)}>
        <button
          aria-controls={`${id}List`}
          aria-describedby={descriptionId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          className={cn(css.segmentedChoice)}
          id={id}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          type="button"
          style={{
            alignItems: 'center',
            background: 'var(--app-bg-elevated)',
            border: '1px solid var(--app-border-default)',
            borderRadius: 10,
            color: 'var(--app-text-primary)',
            display: 'flex',
            flex: '0 0 auto',
            height: 42,
            justifyContent: 'space-between',
            minHeight: 42,
            padding: '0.45rem 0.65rem',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span
            className={cn(css.segmentedChoiceLabel)}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedLabel}
          </span>
          <span
            aria-hidden="true"
            className={cn(css.segmentedChoiceDescription)}
          >
            {isOpen
              ? t('works.form.genreToggleClose')
              : t('works.form.genreToggleOpen')}
          </span>
        </button>

        {isOpen && (
          <Box
            aria-labelledby={labelId}
            className={cn(css.genreDropdown)}
            id={`${id}List`}
            role="listbox"
          >
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={4}>
              {WORK_GENRES.map((genre) => {
                const isSelected = selectedGenres.has(genre);
                const isDisabled =
                  !isSelected && value.length >= MAX_WORK_GENRES;

                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(css.genreChoice)}
                    data-active={isSelected ? 'true' : 'false'}
                    disabled={isDisabled}
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    role="option"
                    type="button"
                  >
                    {genre}
                  </button>
                );
              })}
            </SimpleGrid>
          </Box>
        )}
      </Box>
      {helperText && (
        <Text c="dimmed" id={descriptionId} size="xs">
          {helperText}
        </Text>
      )}
    </Stack>
  );
}
