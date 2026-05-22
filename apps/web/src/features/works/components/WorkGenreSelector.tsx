import { useState } from 'react';
import { Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';

import {
  MAX_WORK_GENRES,
  WORK_GENRES,
  type WorkGenreValue,
} from '../utils/work-genres';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

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
  label = '장르',
  onChange,
  value,
}: WorkGenreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedGenres = new Set(value);
  const labelId = `${id}Label`;
  const descriptionId = description ? `${id}Description` : undefined;
  const selectedLabel =
    value.length > 0 ? value.join(', ') : '장르 선택';
  const helperText =
    value.length >= MAX_WORK_GENRES
      ? '장르는 최대 3개까지 선택할 수 있습니다. 세부 키워드는 개인 태그에 남겨주세요.'
      : description;

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
        <Text fw={600} id={labelId} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
          {label}
        </Text>
        <Text c="dimmed" size="xs">
          {value.length} / {MAX_WORK_GENRES}
        </Text>
      </Group>
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
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {selectedLabel}
        </span>
        <span aria-hidden="true" className={cn(css.segmentedChoiceDescription)}>
          {isOpen ? '접기' : '선택'}
        </span>
      </button>
      {helperText && (
        <Text c="dimmed" id={descriptionId} size="xs">
          {helperText}
        </Text>
      )}

      {isOpen && (
        <Paper
          aria-labelledby={labelId}
          id={`${id}List`}
          p={6}
          radius="md"
          role="listbox"
          style={{
            background: 'var(--app-surface-card)',
            borderColor: 'var(--app-border-default)',
            boxShadow: 'var(--wa-shadow-xs)',
          }}
          withBorder
        >
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={4}>
            {WORK_GENRES.map((genre) => {
              const isSelected = selectedGenres.has(genre);
              const isDisabled = !isSelected && value.length >= MAX_WORK_GENRES;

              return (
                <button
                  aria-selected={isSelected}
                  disabled={isDisabled}
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  role="option"
                  type="button"
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--app-accent-primary) 18%, transparent)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid color-mix(in srgb, var(--app-accent-primary) 40%, transparent)'
                      : '1px solid transparent',
                    borderRadius: 8,
                    color: isSelected
                      ? 'var(--app-accent-primary)'
                      : 'var(--app-text-secondary)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    font: 'inherit',
                    fontSize: '0.82rem',
                    fontWeight: 650,
                    lineHeight: 1.15,
                    minHeight: 30,
                    opacity: isDisabled ? 0.45 : 1,
                    padding: '0.35rem 0.45rem',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  {genre}
                </button>
              );
            })}
          </SimpleGrid>
        </Paper>
      )}
    </Stack>
  );
}
