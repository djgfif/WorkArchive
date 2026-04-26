import { useEffect, useState } from 'react';
import { Center, Paper, Stack, Text } from '@mantine/core';

interface ArtworkPosterProps {
  className?: string;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: 'card' | 'detail' | 'form' | 'grid' | 'row';
}

function getPosterSize(variant: ArtworkPosterProps['variant']) {
  switch (variant) {
    case 'detail':
      return 'clamp(11rem, 22vw, 15rem)';
    case 'form':
      return '8.75rem';
    case 'row':
      return '5.5rem';
    case 'grid':
      return '100%';
    case 'card':
    default:
      return '7rem';
  }
}

export function ArtworkPoster({
  className,
  thumbnailUrl,
  title,
  typeLabel,
  variant = 'card',
}: ArtworkPosterProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const width = getPosterSize(variant);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailUrl]);

  if (thumbnailUrl && !imageFailed) {
    return (
      <Paper
        radius="lg"
        style={{
          flexShrink: 0,
          overflow: 'hidden',
          width,
        }}
        {...(className ? { className } : {})}
        withBorder
      >
        <img
          alt={`${title} 표지 이미지`}
          onError={() => setImageFailed(true)}
          src={thumbnailUrl}
          style={{
            aspectRatio: '3 / 4',
            display: 'block',
            objectFit: 'cover',
            width: '100%',
          }}
        />
      </Paper>
    );
  }

  return (
    <Paper
      radius="lg"
      style={{
        aspectRatio: '3 / 4',
        flexShrink: 0,
        overflow: 'hidden',
        width,
      }}
      {...(className ? { className } : {})}
      withBorder
    >
      <Center h="100%">
        <Stack align="center" gap={6} px="sm">
          <Text c="var(--app-text-secondary)" fw={700} fz="1.9rem">
            {(title.trim()[0] ?? 'W').toUpperCase()}
          </Text>
          {typeLabel && (
            <Text c="var(--app-text-muted)" fw={600} fz="0.72rem" lts="0.1em" ta="center" tt="uppercase">
              {typeLabel}
            </Text>
          )}
        </Stack>
      </Center>
    </Paper>
  );
}
