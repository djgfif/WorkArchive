import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { toPng } from 'html-to-image';
import { useParams } from 'react-router-dom';

import type { TierBoardCardRecord } from '@work-archive/shared-types';
import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { usePageTitle } from '@shared/hooks/usePageTitle';
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
  const { t } = useAppTranslation();
  const { boardId } = useParams();
  const [state, setState] = useState<TierBoardEditorState | null>(null);
  usePageTitle(state?.board.title ?? t('tierBoards.viewPageTitle'));
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (!canvasRef.current) {
      return;
    }

    try {
      setExporting(true);
      setExportError(null);
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: '#0c0b0a',
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = t('tierBoards.viewExportFileName', {
        title: state?.board.title ?? 'tier-board',
      });
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError(
        t('tierBoards.viewExportError'),
      );
    } finally {
      setExporting(false);
    }
  }

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
        {t('tierBoards.loading')}
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
            <AppBadge tone="muted">
              {t(`tierBoards.visibility.${state.board.visibility}`)}
            </AppBadge>
          </Group>
          {state.board.description && (
            <Text c="dimmed" size="sm">
              {state.board.description}
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          <AppButton
            loading={exporting}
            onClick={() => void handleExport()}
            tone="primary"
            type="button"
          >
            {t('tierBoards.exportImage')}
          </AppButton>
          <AppLinkButton to={`/tier-boards/${boardId}`} tone="secondary">
            {t('common.edit')}
          </AppLinkButton>
        </Group>
      </Group>

      {exportError && (
        <FeedbackMessage tone="error">{exportError}</FeedbackMessage>
      )}

      <Paper className={cn(css.canvas)} p={0} ref={canvasRef}>
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
