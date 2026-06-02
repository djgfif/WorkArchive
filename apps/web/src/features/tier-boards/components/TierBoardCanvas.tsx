import { useEffect, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type {
  TierBoardCardRecord,
  TierLaneRecord,
} from '@work-archive/shared-types';
import {
  getCardSortableId,
  getLaneContainerId,
  getLaneSortableId,
} from '../utils/tier-board-editor-helpers';
import styles from '../pages/TierBoardsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

export function DroppableZone({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id: string;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className={className} ref={setNodeRef}>
      {children}
    </div>
  );
}

export function CardImage({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <Box className={cn(css.itemFallback)}>
        <Text fw={800}>{title.slice(0, 1).toUpperCase()}</Text>
      </Box>
    );
  }

  return (
    <img
      alt={title}
      className={cn(css.itemImage)}
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      src={imageUrl}
    />
  );
}

export function CardTile({
  assetUrls,
  card,
  dragHandleProps,
  isDragging = false,
  isOverlay = false,
  menu,
  setNodeRef,
  showTitle = true,
  style,
}: {
  assetUrls: Map<string, string>;
  card: TierBoardCardRecord;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
  menu?: ReactNode;
  setNodeRef?: (node: HTMLDivElement | null) => void;
  showTitle?: boolean;
  style?: CSSProperties;
}) {
  const imageUrl = assetUrls.get(card.imageUrl) ?? card.imageUrl;
  const details = [card.subtitle, card.note].filter(Boolean).join(' · ');

  return (
    <Paper
      className={[
        cn(css.itemCard),
        isDragging ? cn(css.dragging) : '',
        isOverlay ? cn(css.dragOverlayCard) : '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={setNodeRef}
      style={style}
      title={details ? `${card.title} · ${details}` : card.title}
      withBorder
    >
      <Box
        {...dragHandleProps}
        aria-label={`${card.title} 이동`}
        className={cn(css.itemDragHandle)}
        role="button"
        tabIndex={0}
      >
        <CardImage imageUrl={imageUrl} title={card.title} />
        {showTitle && (
          <Box className={cn(css.itemTitleOverlay)}>
            <Text fw={800} lineClamp={2} size="xs">
              {card.title}
            </Text>
          </Box>
        )}
      </Box>
      {menu}
    </Paper>
  );
}

function CardMenu({
  card,
  lanes,
  onDelete,
  onDuplicate,
  onEdit,
  onMove,
}: {
  card: TierBoardCardRecord;
  lanes: TierLaneRecord[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (card: TierBoardCardRecord) => void;
  onMove: (id: string, laneId: string | null) => void;
}) {
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon
          aria-label={`${card.title} 메뉴`}
          className={cn(css.itemMenuButton)}
          size="sm"
          variant="filled"
        >
          ⋯
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>이동</Menu.Label>
        <Menu.Item onClick={() => onMove(card.id, null)}>
          미배치로 이동
        </Menu.Item>
        {lanes.map((lane) => (
          <Menu.Item key={lane.id} onClick={() => onMove(card.id, lane.id)}>
            {lane.title}로 이동
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item onClick={() => onEdit(card)}>카드 수정</Menu.Item>
        <Menu.Item onClick={() => onDuplicate(card.id)}>카드 복제</Menu.Item>
        <Menu.Item color="red" onClick={() => onDelete(card.id)}>
          카드 삭제
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function SortableCard({
  assetUrls,
  card,
  lanes,
  onDelete,
  onDuplicate,
  onEdit,
  onMove,
  showTitle,
}: {
  assetUrls: Map<string, string>;
  card: TierBoardCardRecord;
  lanes: TierLaneRecord[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (card: TierBoardCardRecord) => void;
  onMove: (id: string, laneId: string | null) => void;
  showTitle: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getCardSortableId(card.id) });

  return (
    <CardTile
      assetUrls={assetUrls}
      card={card}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      menu={
        <CardMenu
          card={card}
          lanes={lanes}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onMove={onMove}
        />
      }
      setNodeRef={setNodeRef}
      showTitle={showTitle}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    />
  );
}

export function SortableLane({
  assetUrls,
  cards,
  lane,
  lanes,
  onDeleteCard,
  onDeleteLane,
  onDuplicateCard,
  onEditCard,
  onMoveCard,
  onMoveLane,
  onUpdateLane,
  showCardTitles,
}: {
  assetUrls: Map<string, string>;
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
  lanes: TierLaneRecord[];
  onDeleteCard: (id: string) => void;
  onDeleteLane: (id: string) => void;
  onDuplicateCard: (id: string) => void;
  onEditCard: (card: TierBoardCardRecord) => void;
  onMoveCard: (id: string, laneId: string | null) => void;
  onMoveLane: (id: string, delta: number) => void;
  onUpdateLane: (lane: TierLaneRecord) => void;
  showCardTitles: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getLaneSortableId(lane.id) });
  const { setNodeRef: setDropNodeRef } = useDroppable({
    id: getLaneContainerId(lane.id),
  });
  const setLaneNodeRef = (node: HTMLDivElement | null) => {
    setSortableNodeRef(node);
    setDropNodeRef(node);
  };

  return (
    <div
      className={`${cn(css.lane)} ${isDragging ? cn(css.dragging) : ''}`}
      ref={setLaneNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack className={cn(css.laneHeader)} gap="sm" p="md">
        <Box
          className={cn(css.laneLabel)}
          style={{
            backgroundColor: lane.colorToken,
            color: '#fff',
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Title order={3} size="h3">
                {lane.title}
              </Title>
              <Text className={cn(css.laneCount)} size="xs">
                {cards.length}
              </Text>
            </Group>
            <ActionIcon
              {...attributes}
              {...listeners}
              aria-label={`${lane.title} 행 이동`}
              color="gray"
              size="sm"
              variant="subtle"
            >
              ↕
            </ActionIcon>
          </Group>
        </Box>
        {lane.description && (
          <Text c="dimmed" size="sm">
            {lane.description}
          </Text>
        )}
        <Group gap={4}>
          <ActionIcon
            aria-label={`${lane.title} 위로`}
            onClick={() => onMoveLane(lane.id, -1)}
            size="sm"
            variant="subtle"
          >
            ↑
          </ActionIcon>
          <ActionIcon
            aria-label={`${lane.title} 아래로`}
            onClick={() => onMoveLane(lane.id, 1)}
            size="sm"
            variant="subtle"
          >
            ↓
          </ActionIcon>
          <ActionIcon
            aria-label={`${lane.title} 수정`}
            onClick={() => onUpdateLane(lane)}
            size="sm"
            variant="subtle"
          >
            ✎
          </ActionIcon>
          <ActionIcon
            aria-label={`${lane.title} 삭제`}
            color="red"
            onClick={() => onDeleteLane(lane.id)}
            size="sm"
            variant="subtle"
          >
            ×
          </ActionIcon>
        </Group>
      </Stack>
      <div className={cn(css.laneDropZone)}>
        <Box p="md">
          <SortableContext
            items={cards.map((card) => getCardSortableId(card.id))}
            strategy={rectSortingStrategy}
          >
            <div className={cn(css.itemGrid)}>
              {cards.map((card) => (
                <SortableCard
                  assetUrls={assetUrls}
                  card={card}
                  key={card.id}
                  lanes={lanes}
                  onDelete={onDeleteCard}
                  onDuplicate={onDuplicateCard}
                  onEdit={onEditCard}
                  onMove={onMoveCard}
                  showTitle={showCardTitles}
                />
              ))}
              {cards.length === 0 && (
                <Box className={cn(css.emptyLane)}>
                  <Text c="dimmed" size="sm">
                    여기에 카드를 놓으세요.
                  </Text>
                </Box>
              )}
            </div>
          </SortableContext>
        </Box>
      </div>
    </div>
  );
}
