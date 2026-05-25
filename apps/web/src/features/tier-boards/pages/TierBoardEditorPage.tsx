import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toBlob, toPng } from 'html-to-image';
import { useNavigate, useParams } from 'react-router-dom';

import type {
  TierBoardCardRecord,
  TierBoardType,
  TierBoardVisibility,
  TierLaneRecord,
  WorkRecord,
} from '@work-archive/shared-types';
import {
  AppBadge,
  AppButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import { worksRepository } from '@features/works';
import {
  TIER_BOARD_TEMPLATES,
  tierBoardService,
  type TierLaneDeleteSnapshot,
} from '../services/tier-board.service';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import styles from './TierBoardsPage.module.css';

const css = styles as Record<string, string>;
const POOL_ID = 'pool';
const LANE_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#64748b'];
const CARD_DROP_ANIMATION = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.18',
      },
    },
  }),
};

function cn(value: string | undefined) {
  return value ?? '';
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const anchor = document.createElement('a');

  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function getLaneContainerId(laneId: string) {
  return `lane-drop:${laneId}`;
}

function getPoolContainerId() {
  return 'pool-drop';
}

function getLaneSortableId(laneId: string) {
  return `lane:${laneId}`;
}

function getCardSortableId(cardId: string) {
  return `card:${cardId}`;
}

function parseLaneSortableId(id: string) {
  return id.startsWith('lane:') ? id.slice(5) : null;
}

function parseCardSortableId(id: string) {
  return id.startsWith('card:') ? id.slice(5) : null;
}

function parseDropLaneId(id: string) {
  if (id === POOL_ID || id === getPoolContainerId()) return null;
  if (id.startsWith('lane-drop:')) return id.slice(10);
  if (id.startsWith('lane:')) return id.slice(5);

  return undefined;
}

function isCardDropTargetId(id: string) {
  return (
    id === getPoolContainerId() ||
    id.startsWith('lane-drop:') ||
    id.startsWith('card:')
  );
}

function isLaneDragId(id: string | null) {
  return id?.startsWith('lane:') ?? false;
}

function getCardsForLane(cards: TierBoardCardRecord[], laneId: string | null) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function applyLaneOrderPreview(
  state: TierBoardEditorState,
  laneIds: string[],
): TierBoardEditorState {
  const orderById = new Map(laneIds.map((id, index) => [id, index]));

  return {
    ...state,
    lanes: state.lanes
      .map((lane) => ({
        ...lane,
        orderIndex: orderById.get(lane.id) ?? lane.orderIndex,
      }))
      .sort((left, right) => left.orderIndex - right.orderIndex),
  };
}

function applyCardOrderPreview(
  state: TierBoardEditorState,
  cardId: string,
  laneId: string | null,
  cardIds: string[],
): TierBoardEditorState {
  const orderById = new Map(cardIds.map((id, index) => [id, index]));
  const fallbackOrder = cardIds.length;

  return {
    ...state,
    cards: state.cards.map((card) => {
      if (card.id === cardId || orderById.has(card.id)) {
        return {
          ...card,
          laneId,
          orderIndex: orderById.get(card.id) ?? fallbackOrder,
        };
      }

      return card;
    }),
  };
}

function applyCardMovePreview(
  state: TierBoardEditorState,
  cardId: string,
  laneId: string | null,
): TierBoardEditorState {
  const nextOrderIndex = getCardsForLane(state.cards, laneId).filter((card) => card.id !== cardId).length;

  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            laneId,
            orderIndex: nextOrderIndex,
          }
        : card,
    ),
  };
}

function createWorkSubtitle(work: WorkRecord) {
  return [
    work.type,
    work.author,
    work.rating === null ? null : `★ ${work.rating.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function DroppableZone({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  const { setNodeRef } = useDroppable({ id });

  return <div className={className} ref={setNodeRef}>{children}</div>;
}

function CardImage({
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

function CardTile({
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
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
  menu?: React.ReactNode;
  setNodeRef?: (node: HTMLDivElement | null) => void;
  showTitle?: boolean;
  style?: React.CSSProperties;
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
        <Menu.Item onClick={() => onMove(card.id, null)}>미배치로 이동</Menu.Item>
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

function SortableCard({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: getCardSortableId(card.id) });

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

function SortableLane({
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
  } =
    useSortable({ id: getLaneSortableId(lane.id) });
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
          <ActionIcon aria-label={`${lane.title} 위로`} onClick={() => onMoveLane(lane.id, -1)} size="sm" variant="subtle">
            ↑
          </ActionIcon>
          <ActionIcon aria-label={`${lane.title} 아래로`} onClick={() => onMoveLane(lane.id, 1)} size="sm" variant="subtle">
            ↓
          </ActionIcon>
          <ActionIcon aria-label={`${lane.title} 수정`} onClick={() => onUpdateLane(lane)} size="sm" variant="subtle">
            ✎
          </ActionIcon>
          <ActionIcon aria-label={`${lane.title} 삭제`} color="red" onClick={() => onDeleteLane(lane.id)} size="sm" variant="subtle">
            ×
          </ActionIcon>
        </Group>
      </Stack>
      <div className={cn(css.laneDropZone)}>
        <Box p="md">
          <SortableContext items={cards.map((card) => getCardSortableId(card.id))} strategy={rectSortingStrategy}>
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

export function TierBoardEditorPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<TierBoardEditorState | null>(null);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    boardType: 'classic_tier' as TierBoardType,
    description: '',
    title: '',
    visibility: 'private' as TierBoardVisibility,
  });
  const [laneEditor, setLaneEditor] = useState<TierLaneRecord | null>(null);
  const [cardEditor, setCardEditor] = useState<TierBoardCardRecord | null>(null);
  const [textDraft, setTextDraft] = useState({ note: '', subtitle: '', title: '' });
  const [urlDraft, setUrlDraft] = useState({ imageUrl: '', note: '', subtitle: '', title: '' });
  const [uploadDraft, setUploadDraft] = useState({ note: '', subtitle: '', title: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [workSearch, setWorkSearch] = useState('');
  const [deletedCard, setDeletedCard] = useState<TierBoardCardRecord | null>(null);
  const [deletedLane, setDeletedLane] = useState<TierLaneDeleteSnapshot | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [cardTitleDisplay, setCardTitleDisplay] = useState<'visible' | 'hidden'>('visible');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
  const uploadPreviewUrl = useMemo(
    () => (uploadFile ? URL.createObjectURL(uploadFile) : ''),
    [uploadFile],
  );
  const filteredWorks = useMemo(() => {
    const query = workSearch.trim().toLowerCase();

    return works
      .filter((work) =>
        query
          ? `${work.title} ${work.author} ${work.type}`.toLowerCase().includes(query)
          : true,
      )
      .slice(0, 20);
  }, [workSearch, works]);

  const loadState = useCallback(async () => {
    if (!boardId) return;
    const [nextState, nextWorks] = await Promise.all([
      tierBoardService.getBoardEditorState(boardId),
      worksRepository.listActive(),
    ]);

    if (!nextState) {
      navigate('/tier-boards');
      return;
    }

    setState(nextState);
    setWorks(nextWorks);
  }, [boardId, navigate]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(
    () => () => {
      for (const url of assetUrls.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
    },
    [assetUrls],
  );

  useEffect(
    () => () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    },
    [uploadPreviewUrl],
  );

  if (!boardId || !state) {
    return (
      <FeedbackMessage tone="info">
        티어보드를 불러오는 중입니다.
      </FeedbackMessage>
    );
  }

  const activeBoardId = boardId;
  const editorState = state;
  const poolCards = getCardsForLane(editorState.cards, null);
  const activeDragCardId = activeDragId ? parseCardSortableId(activeDragId) : null;
  const activeDragCard = activeDragCardId
    ? editorState.cards.find((candidate) => candidate.id === activeDragCardId) ?? null
    : null;
  const showCardTitles = cardTitleDisplay === 'visible';
  const collisionDetection: CollisionDetection = (args) => {
    const activeId = String(args.active.id);

    if (isLaneDragId(activeId)) {
      return closestCorners(args);
    }

    const pointerCollisions = pointerWithin(args);
    const pointerCardTargets = pointerCollisions.filter((collision) =>
      isCardDropTargetId(String(collision.id)),
    );

    if (pointerCardTargets.length > 0) {
      return pointerCardTargets;
    }

    const intersectingTargets = rectIntersection(args).filter((collision) =>
      isCardDropTargetId(String(collision.id)),
    );

    if (intersectingTargets.length > 0) {
      return intersectingTargets;
    }

    return closestCorners(args);
  };

  async function refreshWithSuccess(message: string) {
    setFeedback({ message, tone: 'success' });
    await loadState();
  }

  async function handleCreateTextCard() {
    await tierBoardService.createCustomTextCard(activeBoardId, {
      note: textDraft.note,
      subtitle: textDraft.subtitle,
      title: textDraft.title || '텍스트 카드',
    });
    setTextDraft({ note: '', subtitle: '', title: '' });
    await refreshWithSuccess('텍스트 카드를 추가했습니다.');
  }

  async function handleCreateUrlCard() {
    await tierBoardService.createImageUrlCard(activeBoardId, {
      imageUrl: urlDraft.imageUrl,
      note: urlDraft.note,
      subtitle: urlDraft.subtitle,
      title: urlDraft.title || '이미지 카드',
    });
    setUrlDraft({ imageUrl: '', note: '', subtitle: '', title: '' });
    await refreshWithSuccess('이미지 URL 카드를 추가했습니다.');
  }

  function handleUploadFile(file: File | null) {
    setUploadError('');
    setUploadFile(null);

    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('jpg, jpeg, png, webp 이미지만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('이미지 파일은 5MB 이하만 업로드할 수 있습니다.');
      return;
    }
    setUploadFile(file);
    setUploadDraft((draft) => ({ ...draft, title: draft.title || file.name }));
  }

  async function handleUpload() {
    if (!uploadFile) return;
    await tierBoardService.createUploadedImageCard(activeBoardId, uploadFile, {
      note: uploadDraft.note,
      subtitle: uploadDraft.subtitle,
      title: uploadDraft.title || uploadFile.name,
    });
    setUploadDraft({ note: '', subtitle: '', title: '' });
    setUploadFile(null);
    await refreshWithSuccess('업로드 이미지 카드를 추가했습니다.');
  }

  async function handleImportWork(workId: string) {
    await tierBoardService.createCardFromWorkSnapshot(activeBoardId, workId);
    await refreshWithSuccess('작품에서 가져온 snapshot 카드를 추가했습니다.');
  }

  async function handleMoveCard(id: string, laneId: string | null) {
    if (laneId) await tierBoardService.moveCardToLane(id, laneId);
    else await tierBoardService.removeCardFromLane(id);
    await refreshWithSuccess('카드 위치를 저장했습니다.');
  }

  async function handleDeleteCard(id: string) {
    const card = editorState.cards.find((candidate) => candidate.id === id);

    if (
      card &&
      (card.cardSourceType === 'image_upload' || card.note.trim()) &&
      !window.confirm('이 카드는 이미지 또는 메모가 있습니다. 삭제 후 되돌릴 수 있지만 계속할까요?')
    ) {
      return;
    }

    const snapshot = await tierBoardService.deleteCard(id);
    setDeletedCard(snapshot);
    await refreshWithSuccess('카드를 삭제했습니다.');
  }

  async function handleUndoDeleteCard() {
    if (!deletedCard) return;
    await tierBoardService.restoreCardSnapshot(deletedCard);
    setDeletedCard(null);
    await refreshWithSuccess('카드를 복원했습니다.');
  }

  async function handleDeleteLane(id: string) {
    const lane = editorState.lanes.find((candidate) => candidate.id === id);

    if (
      !window.confirm(
        `"${lane?.title ?? '선택한 행'}" 행을 삭제할까요? 이 행의 카드는 미배치 카드로 이동됩니다.`,
      )
    ) {
      return;
    }

    const snapshot = await tierBoardService.deleteLane(id);
    setDeletedLane(snapshot);
    await refreshWithSuccess('행을 삭제하고 카드를 미배치로 옮겼습니다.');
  }

  async function handleUndoDeleteLane() {
    if (!deletedLane) return;
    await tierBoardService.restoreLaneDeleteSnapshot(deletedLane);
    setDeletedLane(null);
    await refreshWithSuccess('행 삭제를 되돌렸습니다.');
  }

  async function handleDuplicateCard(id: string) {
    await tierBoardService.duplicateCard(id);
    await refreshWithSuccess('카드를 복제했습니다.');
  }

  async function handleMoveLane(id: string, delta: number) {
    const laneIds = editorState.lanes.map((lane) => lane.id);
    const index = laneIds.indexOf(id);
    const nextIndex = Math.max(0, Math.min(laneIds.length - 1, index + delta));

    if (index === nextIndex) return;
    await tierBoardService.reorderLane(activeBoardId, arrayMove(laneIds, index, nextIndex));
    await refreshWithSuccess('행 순서를 저장했습니다.');
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDragId(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    setActiveDragId(null);

    try {
      if (!overId || activeId === overId) return;

      const activeLaneId = parseLaneSortableId(activeId);
      if (activeLaneId) {
        const overLaneId = parseLaneSortableId(overId);
        if (!overLaneId) return;
        const laneIds = editorState.lanes.map((lane) => lane.id);
        const oldIndex = laneIds.indexOf(activeLaneId);
        const newIndex = laneIds.indexOf(overLaneId);

        if (oldIndex >= 0 && newIndex >= 0) {
          const nextLaneIds = arrayMove(laneIds, oldIndex, newIndex);
          setState((current) =>
            current && current.board.id === activeBoardId
              ? applyLaneOrderPreview(current, nextLaneIds)
              : current,
          );
          await tierBoardService.reorderLane(activeBoardId, nextLaneIds);
          await loadState();
        }
        return;
      }

      const activeCardId = parseCardSortableId(activeId);
      if (!activeCardId) return;

      const activeCard = editorState.cards.find((candidate) => candidate.id === activeCardId);
      const overCardId = parseCardSortableId(overId);
      const overCard = overCardId
        ? editorState.cards.find((candidate) => candidate.id === overCardId)
        : null;
      const dropLaneId = parseDropLaneId(overId);

      if (!activeCard) return;

      const targetLaneId = overCard ? overCard.laneId : dropLaneId;
      if (targetLaneId === undefined) return;

      if (overCard) {
        const targetCards = getCardsForLane(editorState.cards, targetLaneId);
        const ids = targetCards.map((candidate) => candidate.id);
        const oldIndex = ids.indexOf(activeCardId);
        const newIndex = ids.indexOf(overCard.id);
        const nextIds =
          oldIndex >= 0
            ? arrayMove(ids, oldIndex, newIndex)
            : [...ids.slice(0, newIndex), activeCardId, ...ids.slice(newIndex)];

        setState((current) =>
          current && current.board.id === activeBoardId
            ? applyCardOrderPreview(current, activeCardId, targetLaneId, nextIds)
            : current,
        );
        await tierBoardService.reorderCard(activeBoardId, targetLaneId, nextIds);
      } else if (activeCard.laneId !== targetLaneId) {
        setState((current) =>
          current && current.board.id === activeBoardId
            ? applyCardMovePreview(current, activeCardId, targetLaneId)
            : current,
        );
        if (targetLaneId) await tierBoardService.moveCardToLane(activeCardId, targetLaneId);
        else await tierBoardService.removeCardFromLane(activeCardId);
      }

      await loadState();
    } finally {
      setActiveDragId(null);
    }
  }

  async function handleExportJson() {
    const exported = await tierBoardService.exportBoardJson(activeBoardId);
    downloadText(`${editorState.board.title}.tier-board.json`, JSON.stringify(exported, null, 2));
    await tierBoardService.updateBoard(activeBoardId, { visibility: 'exported' });
    await refreshWithSuccess('JSON 파일로 내보냈습니다.');
  }

  async function handleExportPng() {
    if (!boardRef.current || isExportingPng) return;
    setIsExportingPng(true);
    try {
      const dataUrl = await toPng(boardRef.current, {
        backgroundColor: '#101419',
        cacheBust: true,
        pixelRatio: 2,
      });
      downloadDataUrl(`${editorState.board.title}.png`, dataUrl);
      await refreshWithSuccess('PNG 이미지로 내보냈습니다.');
    } catch {
      setFeedback({
        message: 'PNG 내보내기에 실패했습니다. 외부 이미지 CORS 때문에 실패했을 수 있습니다.',
        tone: 'error',
      });
    } finally {
      setIsExportingPng(false);
    }
  }

  async function handleCopyPng() {
    if (!boardRef.current || !navigator.clipboard || !('ClipboardItem' in window)) return;
    try {
      const blob = await toBlob(boardRef.current, {
        backgroundColor: '#101419',
        cacheBust: true,
        pixelRatio: 2,
      });
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setFeedback({ message: '클립보드에 이미지로 복사했습니다.', tone: 'success' });
    } catch {
      setFeedback({
        message: '클립보드 복사에 실패했습니다. 외부 이미지 CORS 때문에 실패했을 수 있습니다.',
        tone: 'error',
      });
    }
  }

  function openSettings() {
    setSettingsDraft({
      boardType: editorState.board.boardType,
      description: editorState.board.description,
      title: editorState.board.title,
      visibility: editorState.board.visibility,
    });
    setSettingsOpen(true);
  }

  async function saveSettings() {
    await tierBoardService.updateBoard(activeBoardId, settingsDraft);
    setSettingsOpen(false);
    await loadState();
  }

  async function handleCreateLane() {
    await tierBoardService.createLane(activeBoardId, {
      colorToken: '#64748b',
      title: '새 행',
    });
    await refreshWithSuccess('새 행을 추가했습니다.');
  }

  async function saveLaneEditor() {
    if (!laneEditor) return;
    await tierBoardService.updateLane(laneEditor.id, laneEditor);
    setLaneEditor(null);
    await loadState();
  }

  async function saveCardEditor() {
    if (!cardEditor) return;
    await tierBoardService.updateCard(cardEditor.id, {
      imageUrl: cardEditor.imageUrl,
      note: cardEditor.note,
      subtitle: cardEditor.subtitle,
      title: cardEditor.title,
    });
    setCardEditor(null);
    await loadState();
  }

  return (
    <Stack gap="md" py="lg">
      <Paper className={cn(css.toolbar)} p="md">
        <div className={cn(css.toolbarLayout)}>
          <Stack className={cn(css.toolbarIdentity)} gap={6}>
            <Group gap="xs" wrap="nowrap">
              <Title className={cn(css.toolbarTitle)} order={1}>
                {editorState.board.title}
              </Title>
              <AppBadge tone={editorState.board.visibility === 'exported' ? 'info' : 'muted'}>
                {editorState.board.visibility}
              </AppBadge>
            </Group>
            <Text c="dimmed" size="sm">
              {editorState.board.syncStatus === 'synced'
                ? '로컬 저장됨'
                : editorState.board.syncStatus === 'conflict'
                  ? '저장 실패'
                  : '백업 대기'}
            </Text>
          </Stack>

          <Group className={cn(css.toolbarActions)} gap="xs" wrap="wrap">
            <SegmentedControl
              aria-label="카드 제목 표시"
              className={cn(css.toolbarSegment)}
              data={[
                { label: '제목', value: 'visible' },
                { label: '이미지', value: 'hidden' },
              ]}
              onChange={(value) => setCardTitleDisplay(value as 'visible' | 'hidden')}
              size="xs"
              value={cardTitleDisplay}
            />
            <AppButton onClick={() => void handleCreateLane()} size="xs" tone="secondary" type="button">
              행 추가
            </AppButton>
            <AppButton aria-label="보드 설정" onClick={openSettings} size="xs" tone="secondary" type="button">
              설정
            </AppButton>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <Button className={cn(css.toolbarMenuButton)} size="xs" variant="default">
                  내보내기
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => void handleExportPng()}>
                  {isExportingPng ? 'PNG 생성 중' : 'PNG 이미지'}
                </Menu.Item>
                <Menu.Item onClick={() => void handleCopyPng()}>클립보드 복사</Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => void handleExportJson()}>JSON 파일</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon aria-label="보드 작업 더보기" className={cn(css.toolbarIconButton)} size="sm" variant="default">
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  onClick={async () => {
                    const duplicated = await tierBoardService.duplicateBoard(activeBoardId);
                    navigate(`/tier-boards/${duplicated.id}`);
                  }}
                >
                  보드 복제
                </Menu.Item>
                <Menu.Item onClick={() => navigate('/tier-boards')}>목록으로 이동</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </div>
      </Paper>

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          <Group justify="space-between">
            <Text>{feedback.message}</Text>
            <Group gap="xs">
              {deletedCard && (
                <AppButton onClick={() => void handleUndoDeleteCard()} tone="secondary" type="button">
                  카드 되돌리기
                </AppButton>
              )}
              {deletedLane && (
                <AppButton onClick={() => void handleUndoDeleteLane()} tone="secondary" type="button">
                  행 되돌리기
                </AppButton>
              )}
            </Group>
          </Group>
        </FeedbackMessage>
      )}

      <DndContext
        collisionDetection={collisionDetection}
        onDragCancel={handleDragCancel}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className={cn(css.editorShell)} data-testid="tier-board-dnd-context">
          <Paper className={cn(css.sourcePanel)} p="md">
            <Stack gap="md">
              <Group className={cn(css.sourcePanelHeader)} justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text className={cn(css.sourcePanelEyebrow)} size="xs">
                    Quick add
                  </Text>
                  <Title order={2} size="h4">
                    카드 추가
                  </Title>
                </Stack>
                <AppBadge tone="muted">{editorState.cards.length}개</AppBadge>
              </Group>
              <Tabs className={cn(css.addTabs)} defaultValue="upload">
                <Tabs.List className={cn(css.addTabsList)} grow>
                  <Tabs.Tab value="upload">업로드</Tabs.Tab>
                  <Tabs.Tab value="url">이미지 URL</Tabs.Tab>
                  <Tabs.Tab value="text">텍스트</Tabs.Tab>
                  <Tabs.Tab value="work">작품에서 가져오기</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel pt="md" value="upload">
                  <Stack className={cn(css.addForm)} gap="sm">
                    <input
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      hidden
                      onChange={(event) => handleUploadFile(event.currentTarget.files?.[0] ?? null)}
                      ref={uploadInputRef}
                      type="file"
                    />
                    <Paper className={cn(css.quickAddDropzone)} onClick={() => uploadInputRef.current?.click()} p="md" role="button" tabIndex={0}>
                      {uploadFile ? (
                        <Stack gap="xs">
                          <CardImage imageUrl={uploadPreviewUrl} title={uploadFile.name} />
                          <Text c="dimmed" lineClamp={1} size="xs">
                            {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB
                          </Text>
                        </Stack>
                      ) : (
                        <Stack align="center" gap={4}>
                          <Text fw={800} size="sm">이미지 선택</Text>
                          <Text c="dimmed" size="xs">jpg, png, webp · 5MB 이하</Text>
                        </Stack>
                      )}
                    </Paper>
                    {uploadError && <FeedbackMessage tone="error">{uploadError}</FeedbackMessage>}
                    <Stack className={cn(css.addFieldGroup)} gap={6}>
                      <TextInput
                        label="제목"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setUploadDraft((draft) => ({ ...draft, title: value }));
                        }}
                        placeholder="카드 제목"
                        value={uploadDraft.title}
                      />
                    </Stack>
                    <AppButton disabled={!uploadFile} fullWidth onClick={() => void handleUpload()} tone="primary" type="button">
                      카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="url">
                  <Stack className={cn(css.addForm)} gap="sm">
                    <Stack className={cn(css.addFieldGroup)} gap={6}>
                      <TextInput
                        label="이미지 URL"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setUrlDraft((draft) => ({ ...draft, imageUrl: value }));
                        }}
                        placeholder="https://..."
                        value={urlDraft.imageUrl}
                      />
                    </Stack>
                    <Paper className={cn(css.quickAddPreview)} p="xs">
                      <CardImage imageUrl={urlDraft.imageUrl} title={urlDraft.title || '이미지 URL 미리보기'} />
                    </Paper>
                    <Stack className={cn(css.addFieldGroup)} gap={6}>
                      <TextInput
                        label="제목"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setUrlDraft((draft) => ({ ...draft, title: value }));
                        }}
                        placeholder="카드 제목"
                        value={urlDraft.title}
                      />
                    </Stack>
                    <AppButton disabled={!urlDraft.imageUrl.trim()} fullWidth onClick={() => void handleCreateUrlCard()} tone="primary" type="button">
                      카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="text">
                  <Stack className={cn(css.addForm)} gap="sm">
                    <Stack className={cn(css.addFieldGroup)} gap={6}>
                      <TextInput
                        label="제목"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setTextDraft((draft) => ({ ...draft, title: value }));
                        }}
                        placeholder="텍스트 카드 제목"
                        value={textDraft.title}
                      />
                    </Stack>
                    <Paper className={cn(css.quickTextPreview)} p="md">
                      <Text fw={800} lineClamp={2} size="sm">
                        {textDraft.title || '텍스트 카드'}
                      </Text>
                    </Paper>
                    <AppButton fullWidth onClick={() => void handleCreateTextCard()} tone="primary" type="button">
                      카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="work">
                  <Stack className={cn(css.addForm)} gap="sm">
                    <Stack className={cn(css.addFieldGroup)} gap={6}>
                      <TextInput
                        label="작품에서 snapshot 추가"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setWorkSearch(value);
                        }}
                        placeholder="제목, 작가, 유형"
                        value={workSearch}
                      />
                    </Stack>
                    <Stack className={cn(css.workResultList)} gap="xs">
                      {filteredWorks.map((work) => (
                        <Paper className={cn(css.workResult)} key={work.id} p="sm" withBorder>
                          <Group align="center" gap="sm" wrap="nowrap">
                            <Box className={cn(css.workThumb)}>
                              <CardImage imageUrl={work.thumbnailUrl} title={work.title} />
                            </Box>
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text fw={700} lineClamp={1} size="sm">{work.title}</Text>
                              <Text c="dimmed" lineClamp={1} size="xs">{createWorkSubtitle(work)}</Text>
                            </Stack>
                            <AppButton onClick={() => void handleImportWork(work.id)} tone="secondary" type="button">
                              Snapshot 추가
                            </AppButton>
                          </Group>
                        </Paper>
                      ))}
                      {filteredWorks.length === 0 && (
                        <Text c="dimmed" size="sm">snapshot으로 가져올 작품이 없습니다.</Text>
                      )}
                    </Stack>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Paper>

          <Stack className={cn(css.boardWorkspace)} gap="md">
            <Paper className={cn(css.canvas)} ref={boardRef}>
              <SortableContext items={editorState.lanes.map((lane) => getLaneSortableId(lane.id))} strategy={rectSortingStrategy}>
                <ScrollArea type="auto">
                  {editorState.lanes.map((lane) => (
                    <SortableLane
                      assetUrls={assetUrls}
                      cards={getCardsForLane(editorState.cards, lane.id)}
                      key={lane.id}
                      lane={lane}
                      lanes={editorState.lanes}
                      onDeleteCard={(id) => void handleDeleteCard(id)}
                      onDeleteLane={(id) => void handleDeleteLane(id)}
                      onDuplicateCard={(id) => void handleDuplicateCard(id)}
                      onEditCard={setCardEditor}
                      onMoveCard={(id, laneId) => void handleMoveCard(id, laneId)}
                      onMoveLane={(id, delta) => void handleMoveLane(id, delta)}
                      onUpdateLane={(lane) => setLaneEditor({ ...lane })}
                      showCardTitles={showCardTitles}
                    />
                  ))}
                </ScrollArea>
              </SortableContext>
            </Paper>

            <Paper className={cn(css.pool)} p="sm">
              <DroppableZone className={cn(css.poolDropZone)} id={getPoolContainerId()}>
                <Stack gap="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={800} size="sm">
                      미배치 카드
                    </Text>
                    <AppBadge tone="muted">{poolCards.length}개</AppBadge>
                  </Group>
                  <SortableContext items={poolCards.map((card) => getCardSortableId(card.id))} strategy={rectSortingStrategy}>
                    <div className={cn(css.itemBankGrid)}>
                      {poolCards.map((card) => (
                        <SortableCard
                          assetUrls={assetUrls}
                          card={card}
                          key={card.id}
                          lanes={editorState.lanes}
                          onDelete={(id) => void handleDeleteCard(id)}
                          onDuplicate={(id) => void handleDuplicateCard(id)}
                          onEdit={setCardEditor}
                          onMove={(id, laneId) => void handleMoveCard(id, laneId)}
                          showTitle={showCardTitles}
                        />
                      ))}
                      {poolCards.length === 0 && (
                        <Box className={cn(css.emptyPool)}>
                          <Text c="dimmed" size="sm">
                            모든 카드가 배치되었습니다.
                          </Text>
                        </Box>
                      )}
                    </div>
                  </SortableContext>
                </Stack>
              </DroppableZone>
            </Paper>
          </Stack>
        </div>
        <DragOverlay dropAnimation={CARD_DROP_ANIMATION}>
          {activeDragCard ? (
            <CardTile assetUrls={assetUrls} card={activeDragCard} isOverlay showTitle={showCardTitles} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal onClose={() => setSettingsOpen(false)} opened={settingsOpen} title="보드 설정">
        <Stack gap="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Stack gap={2}>
                <Text fw={800}>보드 정보</Text>
                <Text c="dimmed" size="sm">
                  제목, 설명, 보드 표시 방식을 정합니다.
                </Text>
              </Stack>
              <TextInput
                label="보드 제목"
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSettingsDraft((draft) => ({ ...draft, title: value }));
                }}
                value={settingsDraft.title}
              />
              <Textarea
                autosize
                label="보드 설명"
                minRows={2}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSettingsDraft((draft) => ({ ...draft, description: value }));
                }}
                placeholder="이 보드의 기준이나 용도를 적어두세요."
                value={settingsDraft.description}
              />
              <Select
                data={[
                  { label: '티어형', value: 'classic_tier' },
                  { label: '순위형', value: 'ranking' },
                  { label: '자유 배치', value: 'freeform' },
                ]}
                label="보드 방식"
                onChange={(value) => value && setSettingsDraft((draft) => ({ ...draft, boardType: value as TierBoardType }))}
                value={settingsDraft.boardType}
              />
              <Select
                data={[
                  { label: '개인용', value: 'private' },
                  { label: '링크 공유', value: 'link_only' },
                  { label: '내보냄', value: 'exported' },
                ]}
                label="공개 범위"
                onChange={(value) => value && setSettingsDraft((draft) => ({ ...draft, visibility: value as TierBoardVisibility }))}
                value={settingsDraft.visibility}
              />
            </Stack>
          </Paper>

          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Stack gap={2}>
                <Text fw={800}>행 구성</Text>
                <Text c="dimmed" size="sm">
                  S/A/B 같은 티어 행을 추가하거나 기본 행 템플릿으로 바꿉니다.
                </Text>
              </Stack>
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Text fw={700} size="sm">새 행 추가</Text>
                  <Text c="dimmed" size="sm">
                    추가한 행은 보드에서 이름과 색상을 바로 수정할 수 있습니다.
                  </Text>
                </Stack>
                <AppButton onClick={() => void handleCreateLane()} tone="secondary" type="button">
                  행 추가
                </AppButton>
              </Group>
              <Select
                data={TIER_BOARD_TEMPLATES.map((template) => ({
                  label: template.title,
                  value: template.title,
                }))}
                description="선택한 템플릿의 행 구성으로 보드를 다시 만듭니다."
                label="행 템플릿 적용"
                onChange={(value) =>
                  value && void tierBoardService.applyLaneTemplate(activeBoardId, value).then(loadState)
                }
                placeholder="예: 기본 S/A/B/C/D"
              />
            </Stack>
          </Paper>

          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              행 이름과 색상은 각 행의 ✎ 버튼에서 수정합니다.
            </Text>
            <Group gap="xs">
              <AppButton onClick={() => setSettingsOpen(false)} tone="quiet" type="button">
                취소
              </AppButton>
              <AppButton onClick={() => void saveSettings()} tone="primary" type="button">
                저장
              </AppButton>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal onClose={() => setLaneEditor(null)} opened={laneEditor !== null} title="Lane 수정">
        {laneEditor && (
          <Stack gap="md">
            <TextInput
              label="Label"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setLaneEditor({ ...laneEditor, title: value });
              }}
              value={laneEditor.title}
            />
            <Stack gap="xs">
              <Text fw={700} size="sm">Preset color</Text>
              <Group gap="xs">
                {LANE_COLORS.map((color) => (
                  <button
                    aria-label={`색상 ${color}`}
                    className={cn(css.colorChip)}
                    key={color}
                    onClick={() => setLaneEditor({ ...laneEditor, colorToken: color })}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </Group>
            </Stack>
            <TextInput
              label="Hex color"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setLaneEditor({ ...laneEditor, colorToken: value });
              }}
              value={laneEditor.colorToken}
            />
            <Textarea
              autosize
              label="Description"
              minRows={2}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setLaneEditor({ ...laneEditor, description: value });
              }}
              value={laneEditor.description}
            />
            <Group justify="flex-end">
              <AppButton onClick={() => setLaneEditor(null)} tone="quiet" type="button">
                취소
              </AppButton>
              <AppButton onClick={() => void saveLaneEditor()} tone="primary" type="button">
                저장
              </AppButton>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal onClose={() => setCardEditor(null)} opened={cardEditor !== null} title="카드 수정">
        {cardEditor && (
          <Stack gap="md">
            <TextInput
              label="Title"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setCardEditor({ ...cardEditor, title: value });
              }}
              value={cardEditor.title}
            />
            <TextInput
              label="Subtitle"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setCardEditor({ ...cardEditor, subtitle: value });
              }}
              value={cardEditor.subtitle}
            />
            <TextInput
              label="Image URL"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setCardEditor({ ...cardEditor, imageUrl: value });
              }}
              value={cardEditor.imageUrl}
            />
            <Textarea
              autosize
              label="Note"
              minRows={2}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setCardEditor({ ...cardEditor, note: value });
              }}
              value={cardEditor.note}
            />
            <Group justify="flex-end">
              <AppButton onClick={() => setCardEditor(null)} tone="quiet" type="button">
                취소
              </AppButton>
              <AppButton onClick={() => void saveCardEditor()} tone="primary" type="button">
                저장
              </AppButton>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
