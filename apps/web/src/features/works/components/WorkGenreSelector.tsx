import { Button, Group, Stack, Text } from '@mantine/core';

import { WORK_GENRES, type WorkGenreValue } from '../utils/work-genres';
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
  const selectedGenres = new Set(value);
  const labelId = `${id}Label`;
  const descriptionId = description ? `${id}Description` : undefined;

  function toggleGenre(genre: WorkGenreValue) {
    const nextGenres = selectedGenres.has(genre)
      ? WORK_GENRES.filter((candidate) => candidate !== genre && selectedGenres.has(candidate))
      : WORK_GENRES.filter((candidate) => candidate === genre || selectedGenres.has(candidate));

    onChange(nextGenres);
  }

  return (
    <Stack gap="xs">
      <Stack gap={3}>
        <Text fw={600} id={labelId} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
          {label}
        </Text>
        {description && (
          <Text c="dimmed" id={descriptionId} size="xs">
            {description}
          </Text>
        )}
      </Stack>
      <Group
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        gap={4}
        id={id}
        role="group"
        wrap="wrap"
      >
        {WORK_GENRES.map((genre) => {
          const isSelected = selectedGenres.has(genre);

          return (
            <Button
              aria-pressed={isSelected}
              className={cn(css.filterPill)}
              key={genre}
              onClick={() => toggleGenre(genre)}
              size="compact-sm"
              type="button"
              variant="default"
              style={{
                background: isSelected
                  ? 'color-mix(in srgb, var(--app-accent-primary) 18%, transparent)'
                  : 'var(--app-surface-subtle)',
                border: isSelected
                  ? '1.5px solid color-mix(in srgb, var(--app-accent-primary) 40%, transparent)'
                  : '1.5px solid var(--app-border-default)',
                borderRadius: 20,
                color: isSelected
                  ? 'var(--app-accent-primary)'
                  : 'var(--app-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {genre}
            </Button>
          );
        })}
      </Group>
    </Stack>
  );
}
