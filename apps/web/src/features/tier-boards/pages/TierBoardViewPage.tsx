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
import { usePageTitle } from '@shared/hooks/usePageTitle';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import { tierBoardService } from '../services/tier-board.service';
import styles from './TierBoardsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

const visibilityLabels: Record<string, string> = {
  private: '비공개',
  link_only: '링크 공유',
  exported: '내보냄',
};

function getCardsForLane(cards: TierBoardCardRecord[], laneId: string | null) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

export function TierBoardViewPage() {
  const { boardId } = useParams();
  const [state, setState] = useState<TierBoardEditorState | null>(null);
  usePageTitle(state?.board.title ?? '티어보드 보기');
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
      link.download = `${state?.board.title ?? 'tier-board'}-티어표.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError(
        '이미지 내보내기에 실패했습니다. 외부 표지 이미지가 포함된 경우 보안 정책으로 일부가 빠질 수 있습니다.',
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
            <AppBadge tone="muted">
              {visibilityLabels[state.board.visibility] ??
                state.board.visibility}
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
            이미지로 내보내기
          </AppButton>
          <AppLinkButton to={`/tier-boards/${boardId}`} tone="secondary">
            편집
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
