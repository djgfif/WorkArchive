import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
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
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
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
  AppLinkButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import { worksRepository } from '../../works/services/works.repository';
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
  if (id === POOL_ID) return null;
  if (id.startsWith('lane-drop:')) return id.slice(10);
  if (id.startsWith('lane:')) return id.slice(5);

  return undefined;
}

function getCardsForLane(cards: TierBoardCardRecord[], laneId: string | null) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
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
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  const { setNodeRef } = useDroppable({ id });

  return <div ref={setNodeRef}>{children}</div>;
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

function SortableCard({
  assetUrls,
  card,
  lanes,
  onDelete,
  onDuplicate,
  onEdit,
  onMove,
}: {
  assetUrls: Map<string, string>;
  card: TierBoardCardRecord;
  lanes: TierLaneRecord[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (card: TierBoardCardRecord) => void;
  onMove: (id: string, laneId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: getCardSortableId(card.id) });
  const imageUrl = assetUrls.get(card.imageUrl) ?? card.imageUrl;

  return (
    <Paper
      className={`${cn(css.itemCard)} ${isDragging ? cn(css.dragging) : ''}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      withBorder
    >
      <Box {...attributes} {...listeners} aria-label={`${card.title} 이동`} role="button" tabIndex={0}>
        <CardImage imageUrl={imageUrl} title={card.title} />
      </Box>
      <Stack gap={4} p="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} lineClamp={2} size="sm">
            {card.title}
          </Text>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon aria-label={`${card.title} 메뉴`} size="sm" variant="subtle">
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
        </Group>
        {card.subtitle && (
          <Text c="dimmed" lineClamp={1} size="xs">
            {card.subtitle}
          </Text>
        )}
        {card.note && (
          <Text c="dimmed" lineClamp={2} size="xs">
            {card.note}
          </Text>
        )}
      </Stack>
    </Paper>
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: getLaneSortableId(lane.id) });

  return (
    <div
      className={`${cn(css.lane)} ${isDragging ? cn(css.dragging) : ''}`}
      ref={setNodeRef}
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
            <Title order={3} size="h3">
              {lane.title}
            </Title>
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
      <DroppableZone id={getLaneContainerId(lane.id)}>
        <Box p="md">
          <SortableContext items={cards.map((card) => getCardSortableId(card.id))}>
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
                />
              ))}
            </div>
          </SortableContext>
        </Box>
      </DroppableZone>
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
  const sensors = useSensors(
    useSensor(PointerSensor),
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

  async function loadState() {
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
  }

  useEffect(() => {
    void loadState();
  }, [boardId]);

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
    await refreshWithSuccess('내 작품에서 snapshot card를 만들었습니다.');
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

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || activeId === overId) return;

    const activeLaneId = parseLaneSortableId(activeId);
    if (activeLaneId) {
      const overLaneId = parseLaneSortableId(overId);
      if (!overLaneId) return;
      const laneIds = editorState.lanes.map((lane) => lane.id);
      const oldIndex = laneIds.indexOf(activeLaneId);
      const newIndex = laneIds.indexOf(overLaneId);

      if (oldIndex >= 0 && newIndex >= 0) {
        await tierBoardService.reorderLane(activeBoardId, arrayMove(laneIds, oldIndex, newIndex));
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

      await tierBoardService.reorderCard(activeBoardId, targetLaneId, nextIds);
    } else if (activeCard.laneId !== targetLaneId) {
      if (targetLaneId) await tierBoardService.moveCardToLane(activeCardId, targetLaneId);
      else await tierBoardService.removeCardFromLane(activeCardId);
    }

    await loadState();
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
        <Group justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <Title order={1} size="h2">
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
          <Group gap="xs">
            <AppButton onClick={openSettings} tone="secondary" type="button">
              보드 설정
            </AppButton>
            <AppButton onClick={() => void handleExportJson()} tone="secondary" type="button">
              JSON 내보내기
            </AppButton>
            <AppButton disabled={isExportingPng} onClick={() => void handleExportPng()} tone="secondary" type="button">
              {isExportingPng ? 'PNG 생성 중' : 'PNG 이미지로 내보내기'}
            </AppButton>
            <AppButton onClick={() => void handleCopyPng()} tone="quiet" type="button">
              클립보드 복사
            </AppButton>
            <AppButton
              onClick={async () => {
                const duplicated = await tierBoardService.duplicateBoard(activeBoardId);
                navigate(`/tier-boards/${duplicated.id}`);
              }}
              tone="secondary"
              type="button"
            >
              복제
            </AppButton>
            <AppLinkButton to="/tier-boards" tone="quiet">
              목록
            </AppLinkButton>
          </Group>
        </Group>
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

      <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)} sensors={sensors}>
        <div className={cn(css.editorShell)} data-testid="tier-board-dnd-context">
          <Paper className={cn(css.sourcePanel)} p="md">
            <Stack gap="md">
              <Stack gap={4}>
                <Title order={2} size="h3">
                  카드 추가
                </Title>
                <Text c="dimmed" size="sm">
                  작품 DB는 snapshot source로만 사용됩니다.
                </Text>
              </Stack>
              <Tabs defaultValue="text">
                <Tabs.List grow>
                  <Tabs.Tab value="text">텍스트</Tabs.Tab>
                  <Tabs.Tab value="url">이미지 URL</Tabs.Tab>
                  <Tabs.Tab value="upload">업로드</Tabs.Tab>
                  <Tabs.Tab value="work">내 작품</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel pt="md" value="text">
                  <Stack gap="sm">
                    <TextInput label="Title" onChange={(event) => setTextDraft((draft) => ({ ...draft, title: event.currentTarget.value }))} value={textDraft.title} />
                    <TextInput label="Subtitle" onChange={(event) => setTextDraft((draft) => ({ ...draft, subtitle: event.currentTarget.value }))} value={textDraft.subtitle} />
                    <Textarea autosize label="Note" minRows={2} onChange={(event) => setTextDraft((draft) => ({ ...draft, note: event.currentTarget.value }))} value={textDraft.note} />
                    <AppButton onClick={() => void handleCreateTextCard()} tone="primary" type="button">
                      텍스트 카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="url">
                  <Stack gap="sm">
                    <TextInput label="Image URL" onChange={(event) => setUrlDraft((draft) => ({ ...draft, imageUrl: event.currentTarget.value }))} value={urlDraft.imageUrl} />
                    <Paper className={cn(css.previewBox)} p="xs">
                      <CardImage imageUrl={urlDraft.imageUrl} title={urlDraft.title || '이미지 URL 미리보기'} />
                    </Paper>
                    <TextInput label="Title" onChange={(event) => setUrlDraft((draft) => ({ ...draft, title: event.currentTarget.value }))} value={urlDraft.title} />
                    <TextInput label="Subtitle" onChange={(event) => setUrlDraft((draft) => ({ ...draft, subtitle: event.currentTarget.value }))} value={urlDraft.subtitle} />
                    <Textarea autosize label="Note" minRows={2} onChange={(event) => setUrlDraft((draft) => ({ ...draft, note: event.currentTarget.value }))} value={urlDraft.note} />
                    <AppButton disabled={!urlDraft.imageUrl.trim()} onClick={() => void handleCreateUrlCard()} tone="primary" type="button">
                      이미지 URL 카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="upload">
                  <Stack gap="sm">
                    <input
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      hidden
                      onChange={(event) => handleUploadFile(event.currentTarget.files?.[0] ?? null)}
                      ref={uploadInputRef}
                      type="file"
                    />
                    <AppButton onClick={() => uploadInputRef.current?.click()} tone="secondary" type="button">
                      이미지 선택
                    </AppButton>
                    {uploadError && <FeedbackMessage tone="error">{uploadError}</FeedbackMessage>}
                    {uploadFile && (
                      <Paper className={cn(css.previewBox)} p="xs">
                        <CardImage imageUrl={uploadPreviewUrl} title={uploadFile.name} />
                        <Text c="dimmed" size="xs">
                          {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB
                        </Text>
                      </Paper>
                    )}
                    <TextInput label="Title" onChange={(event) => setUploadDraft((draft) => ({ ...draft, title: event.currentTarget.value }))} value={uploadDraft.title} />
                    <TextInput label="Subtitle" onChange={(event) => setUploadDraft((draft) => ({ ...draft, subtitle: event.currentTarget.value }))} value={uploadDraft.subtitle} />
                    <Textarea autosize label="Note" minRows={2} onChange={(event) => setUploadDraft((draft) => ({ ...draft, note: event.currentTarget.value }))} value={uploadDraft.note} />
                    <AppButton disabled={!uploadFile} onClick={() => void handleUpload()} tone="primary" type="button">
                      이미지 업로드 카드 추가
                    </AppButton>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="work">
                  <Stack gap="sm">
                    <TextInput label="작품 검색" onChange={(event) => setWorkSearch(event.currentTarget.value)} value={workSearch} />
                    <Stack gap="xs">
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
                              추가
                            </AppButton>
                          </Group>
                        </Paper>
                      ))}
                      {filteredWorks.length === 0 && (
                        <Text c="dimmed" size="sm">가져올 작품이 없습니다.</Text>
                      )}
                    </Stack>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
              <DroppableZone id={POOL_ID}>
                <Paper className={cn(css.pool)} p="sm">
                  <Stack gap="xs">
                    <Text fw={700} size="sm">
                      미배치 카드
                    </Text>
                    <SortableContext items={poolCards.map((card) => getCardSortableId(card.id))}>
                      <Stack gap="xs">
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
                          />
                        ))}
                      </Stack>
                    </SortableContext>
                  </Stack>
                </Paper>
              </DroppableZone>
            </Stack>
          </Paper>

          <Paper className={cn(css.canvas)} ref={boardRef}>
            <SortableContext items={editorState.lanes.map((lane) => getLaneSortableId(lane.id))}>
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
                  />
                ))}
              </ScrollArea>
            </SortableContext>
          </Paper>
        </div>
      </DndContext>

      <Modal onClose={() => setSettingsOpen(false)} opened={settingsOpen} title="보드 설정">
        <Stack gap="md">
          <TextInput
            label="보드 제목"
            onChange={(event) => setSettingsDraft((draft) => ({ ...draft, title: event.currentTarget.value }))}
            value={settingsDraft.title}
          />
          <Textarea
            autosize
            label="설명"
            minRows={2}
            onChange={(event) => setSettingsDraft((draft) => ({ ...draft, description: event.currentTarget.value }))}
            value={settingsDraft.description}
          />
          <Select
            data={[
              { label: 'Classic tier', value: 'classic_tier' },
              { label: 'Ranking', value: 'ranking' },
              { label: 'Freeform', value: 'freeform' },
            ]}
            label="Board type"
            onChange={(value) => value && setSettingsDraft((draft) => ({ ...draft, boardType: value as TierBoardType }))}
            value={settingsDraft.boardType}
          />
          <Select
            data={[
              { label: 'Private', value: 'private' },
              { label: 'Link only', value: 'link_only' },
              { label: 'Exported', value: 'exported' },
            ]}
            label="Visibility"
            onChange={(value) => value && setSettingsDraft((draft) => ({ ...draft, visibility: value as TierBoardVisibility }))}
            value={settingsDraft.visibility}
          />
          <Select
            data={TIER_BOARD_TEMPLATES.map((template) => ({
              label: template.title,
              value: template.title,
            }))}
            label="기본 템플릿 적용"
            onChange={(value) =>
              value && void tierBoardService.applyLaneTemplate(activeBoardId, value).then(loadState)
            }
            placeholder="템플릿 선택"
          />
          <Group justify="space-between">
            <AppButton
              onClick={() =>
                void tierBoardService
                  .createLane(activeBoardId, {
                    colorToken: '#64748b',
                    title: '새 행',
                  })
                  .then(loadState)
              }
              tone="secondary"
              type="button"
            >
              Lane 추가
            </AppButton>
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
              onChange={(event) => setLaneEditor({ ...laneEditor, title: event.currentTarget.value })}
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
              onChange={(event) => setLaneEditor({ ...laneEditor, colorToken: event.currentTarget.value })}
              value={laneEditor.colorToken}
            />
            <Textarea
              autosize
              label="Description"
              minRows={2}
              onChange={(event) => setLaneEditor({ ...laneEditor, description: event.currentTarget.value })}
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
            <TextInput label="Title" onChange={(event) => setCardEditor({ ...cardEditor, title: event.currentTarget.value })} value={cardEditor.title} />
            <TextInput label="Subtitle" onChange={(event) => setCardEditor({ ...cardEditor, subtitle: event.currentTarget.value })} value={cardEditor.subtitle} />
            <TextInput label="Image URL" onChange={(event) => setCardEditor({ ...cardEditor, imageUrl: event.currentTarget.value })} value={cardEditor.imageUrl} />
            <Textarea autosize label="Note" minRows={2} onChange={(event) => setCardEditor({ ...cardEditor, note: event.currentTarget.value })} value={cardEditor.note} />
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
