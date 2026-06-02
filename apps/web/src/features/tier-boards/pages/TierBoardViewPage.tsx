import { useEffect, useMemo, useState } from 'react';
import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useParams } from 'react-router-dom';

import type { TierBoardCardRecord } from '@work-archive/shared-types';
import {
  AppBadge,
  AppLinkButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import { tierBoardService } from '../services/tier-board.service';
import styles from './TierBoardsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

function getCardsForLane(cards: TierBoardCardRecord[], laneId: string | null) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

export function TierBoardViewPage() {
  const { boardId } = useParams();
  const [state, setState] = useState<TierBoardEditorState | null>(null);

  useEffect(() => {
    if (!boardId) return;
    void tierBoardService.getBoardEditorState(boardId).then(setState);
  }, [boardId]);

  const assetUrls = useMemo(() => {
    const urls = new Map<string, string>();

    for (const asset of state?.assets ?? []) {
      if (asset.storageType === 'local_blob' && asset.blob instanceof Blob) {
        urls.set(asset.objectUrl, URL.createObjectURL(asset.blob));
      } else if (asset.storageType === 'local_blob' && asset.dataUrl) {
        urls.set(asset.objectUrl, asset.dataUrl);
      } else {
        urls.set(asset.objectUrl, asset.objectUrl);
      }
    }

    return urls;
  }, [state?.assets]);

  useEffect(
    () => () => {
      for (const url of assetUrls.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
    },
    [assetUrls],
  );

  if (!boardId || !state) {
    return (
      <FeedbackMessage tone="info">
        티어보드를 불러오는 중입니다.
      </FeedbackMessage>
    );
  }

  return (
    <Stack gap="lg" py="lg">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={1} size="h2">
              {state.board.title}
            </Title>
            <AppBadge tone="muted">{state.board.visibility}</AppBadge>
          </Group>
          {state.board.description && (
            <Text c="dimmed" size="sm">
              {state.board.description}
            </Text>
          )}
        </Stack>
        <AppLinkButton to={`/tier-boards/${boardId}`} tone="secondary">
          편집
        </AppLinkButton>
      </Group>

      <Paper className={cn(css.canvas)} p={0}>
        {state.lanes.map((lane) => (
          <div className={cn(css.lane)} key={lane.id}>
            <Stack className={cn(css.laneHeader)} gap="sm" p="md">
              <Box
                className={cn(css.laneLabel)}
                style={{ backgroundColor: lane.colorToken, color: '#fff' }}
              >
                <Title order={2} size="h3">
                  {lane.title}
                </Title>
              </Box>
              {lane.description && (
                <Text c="dimmed" size="sm">
                  {lane.description}
                </Text>
              )}
            </Stack>
            <Box p="md">
              <div className={cn(css.itemGrid)}>
                {getCardsForLane(state.cards, lane.id).map((card) => {
                  const imageUrl =
                    assetUrls.get(card.imageUrl) ?? card.imageUrl;

                  return (
                    <Paper
                      className={cn(css.itemCard)}
                      key={card.id}
                      withBorder
                    >
                      {imageUrl ? (
                        <img
                          alt={card.title}
                          className={cn(css.itemImage)}
                          crossOrigin="anonymous"
                          src={imageUrl}
                        />
                      ) : (
                        <Box className={cn(css.itemFallback)}>
                          <Text fw={800}>
                            {card.title.slice(0, 1).toUpperCase()}
                          </Text>
                        </Box>
                      )}
                      <Stack gap={4} p="xs">
                        <Text fw={700} lineClamp={2} size="sm">
                          {card.title}
                        </Text>
                        {card.subtitle && (
                          <Text c="dimmed" lineClamp={1} size="xs">
                            {card.subtitle}
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </div>
            </Box>
          </div>
        ))}
      </Paper>
    </Stack>
  );
}
