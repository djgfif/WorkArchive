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
} from '../services/tier-board.service';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import styles from './TierBoardsPage.module.css';

const css = styles as Record<string, string>;

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

function getContainerId(laneId: string | null) {
  return laneId === null ? 'pool' : `lane:${laneId}`;
}

function parseContainerId(id: string) {
  return id === 'pool' ? null : id.startsWith('lane:') ? id.slice(5) : null;
}

function getCardsForLane(cards: TierBoardCardRecord[], laneId: string | null) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
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

function SortableCard({
  assetUrls,
  card,
  lanes,
  onDelete,
  onMove,
}: {
  assetUrls: Map<string, string>;
  card: TierBoardCardRecord;
  lanes: TierLaneRecord[];
  onDelete: (id: string) => void;
  onMove: (id: string, laneId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
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
        {imageUrl ? (
          <img alt={card.title} className={cn(css.itemImage)} src={imageUrl} />
        ) : (
          <Box className={cn(css.itemFallback)}>
            <Text fw={800}>{card.title.slice(0, 1).toUpperCase()}</Text>
          </Box>
        )}
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
              <Menu.Item color="red" onClick={() => onDelete(card.id)}>
                삭제
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
  onDeleteItem,
  onDeleteLane,
  onMoveItem,
  onMoveLane,
  onUpdateLane,
}: {
  assetUrls: Map<string, string>;
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
  lanes: TierLaneRecord[];
  onDeleteItem: (id: string) => void;
  onDeleteLane: (id: string) => void;
  onMoveItem: (id: string, laneId: string | null) => void;
  onMoveLane: (id: string, delta: number) => void;
  onUpdateLane: (lane: TierLaneRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lane.id });

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
      <DroppableZone id={getContainerId(lane.id)}>
        <Box p="md">
          <SortableContext items={cards.map((card) => card.id)}>
            <div className={cn(css.itemGrid)}>
              {cards.map((card) => (
                <SortableCard
                  assetUrls={assetUrls}
                  card={card}
                  key={card.id}
                  lanes={lanes}
                  onDelete={onDeleteItem}
                  onMove={onMoveItem}
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
  const [laneEditor, setLaneEditor] = useState<TierLaneRecord | null>(null);
  const [cardDraft, setCardDraft] = useState({ imageUrl: '', note: '', subtitle: '', title: '' });
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [deletedCard, setDeletedCard] = useState<TierBoardCardRecord | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const assetUrls = useMemo(() => {
    const urls = new Map<string, string>();

    for (const asset of state?.assets ?? []) {
      if (asset.storageType === 'local_blob' && asset.blob) {
        urls.set(asset.objectUrl, URL.createObjectURL(asset.blob));
      } else {
        urls.set(asset.objectUrl, asset.objectUrl);
      }
    }

    return urls;
  }, [state?.assets]);

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
      note: cardDraft.note,
      subtitle: cardDraft.subtitle,
      title: cardDraft.title || '텍스트 카드',
    });
    setCardDraft({ imageUrl: '', note: '', subtitle: '', title: '' });
    await refreshWithSuccess('텍스트 카드를 추가했습니다.');
  }

  async function handleCreateUrlCard() {
    await tierBoardService.createImageUrlCard(activeBoardId, {
      imageUrl: cardDraft.imageUrl,
      note: cardDraft.note,
      subtitle: cardDraft.subtitle,
      title: cardDraft.title || '이미지 카드',
    });
    setCardDraft({ imageUrl: '', note: '', subtitle: '', title: '' });
    await refreshWithSuccess('이미지 URL 카드를 추가했습니다.');
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    await tierBoardService.createUploadedImageCard(activeBoardId, file, {
      note: cardDraft.note,
      subtitle: cardDraft.subtitle,
      title: cardDraft.title || file.name,
    });
    await refreshWithSuccess('업로드 이미지 카드를 추가했습니다.');
  }

  async function handleImportWork() {
    if (!selectedWorkId) return;
    await tierBoardService.createCardFromWorkSnapshot(activeBoardId, selectedWorkId);
    setSelectedWorkId(null);
    await refreshWithSuccess('내 작품에서 snapshot card을 만들었습니다.');
  }

  async function handleMoveCard(id: string, laneId: string | null) {
    if (laneId) await tierBoardService.moveCardToLane(id, laneId);
    else await tierBoardService.removeCardFromLane(id);
    await refreshWithSuccess('카드 위치를 저장했습니다.');
  }

  async function handleDeleteCard(id: string) {
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
    await tierBoardService.deleteLane(id);
    await refreshWithSuccess('행을 삭제하고 항목을 미배치로 옮겼습니다.');
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

    if (editorState.lanes.some((lane) => lane.id === activeId)) {
      const laneIds = editorState.lanes.map((lane) => lane.id);
      const oldIndex = laneIds.indexOf(activeId);
      const newIndex = laneIds.indexOf(overId);

      if (oldIndex >= 0 && newIndex >= 0) {
        await tierBoardService.reorderLane(activeBoardId, arrayMove(laneIds, oldIndex, newIndex));
        await loadState();
      }
      return;
    }

    const card = editorState.cards.find((candidate) => candidate.id === activeId);

    if (!card) return;

    const overCard = editorState.cards.find((candidate) => candidate.id === overId);
    const targetLaneId = overCard?.laneId ?? parseContainerId(overId);
    const targetCards = getCardsForLane(editorState.cards, targetLaneId);

    if (overCard) {
      const ids = targetCards.map((candidate) => candidate.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      const nextIds =
        oldIndex >= 0
          ? arrayMove(ids, oldIndex, newIndex)
          : [...ids.slice(0, newIndex), activeId, ...ids.slice(newIndex)];

      await tierBoardService.reorderCard(activeBoardId, targetLaneId, nextIds);
    } else {
      await handleMoveCard(activeId, targetLaneId);
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
    if (!boardRef.current) return;
    const dataUrl = await toPng(boardRef.current, { cacheBust: true, pixelRatio: 2 });
    downloadDataUrl(`${editorState.board.title}.png`, dataUrl);
    await refreshWithSuccess('PNG 이미지로 내보냈습니다.');
  }

  async function handleCopyPng() {
    if (!boardRef.current || !navigator.clipboard || !('ClipboardItem' in window)) return;
    const blob = await toBlob(boardRef.current, { cacheBust: true, pixelRatio: 2 });
    if (!blob) return;
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
    setFeedback({ message: '클립보드에 이미지로 복사했습니다.', tone: 'success' });
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
            <AppButton onClick={() => setSettingsOpen(true)} tone="secondary" type="button">
              보드 설정
            </AppButton>
            <AppButton onClick={() => void handleExportJson()} tone="secondary" type="button">
              JSON 내보내기
            </AppButton>
            <AppButton onClick={() => void handleExportPng()} tone="secondary" type="button">
              PNG 이미지로 내보내기
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
            {deletedCard && (
              <AppButton onClick={() => void handleUndoDeleteCard()} tone="secondary" type="button">
                되돌리기
              </AppButton>
            )}
          </Group>
        </FeedbackMessage>
      )}

      <div className={cn(css.editorShell)}>
        <Paper className={cn(css.sourcePanel)} p="md">
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2} size="h3">
                Card source
              </Title>
              <Text c="dimmed" size="sm">
                작품 DB는 snapshot source로만 사용됩니다.
              </Text>
            </Stack>
            <TextInput
              label="Title"
              onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.currentTarget.value }))}
              value={cardDraft.title}
            />
            <TextInput
              label="Subtitle"
              onChange={(event) => setCardDraft((draft) => ({ ...draft, subtitle: event.currentTarget.value }))}
              value={cardDraft.subtitle}
            />
            <TextInput
              label="Image URL"
              onChange={(event) => setCardDraft((draft) => ({ ...draft, imageUrl: event.currentTarget.value }))}
              value={cardDraft.imageUrl}
            />
            <Textarea
              autosize
              label="Note"
              minRows={2}
              onChange={(event) => setCardDraft((draft) => ({ ...draft, note: event.currentTarget.value }))}
              value={cardDraft.note}
            />
            <Group gap="xs">
              <AppButton onClick={() => void handleCreateTextCard()} tone="primary" type="button">
                텍스트 카드 추가
              </AppButton>
              <AppButton onClick={() => void handleCreateUrlCard()} tone="secondary" type="button">
                이미지 URL 카드 추가
              </AppButton>
            </Group>
            <input
              accept="image/jpeg,image/jpg,image/png,image/webp"
              hidden
              onChange={(event) => void handleUpload(event.currentTarget.files?.[0] ?? null)}
              ref={uploadInputRef}
              type="file"
            />
            <AppButton onClick={() => uploadInputRef.current?.click()} tone="secondary" type="button">
              이미지 업로드 카드 추가
            </AppButton>
            <Select
              data={works.map((work) => ({
                label: work.title,
                value: work.id,
              }))}
              label="내 작품에서 가져오기"
              onChange={setSelectedWorkId}
              placeholder="작품 검색"
              searchable
              value={selectedWorkId}
            />
            <AppButton disabled={!selectedWorkId} onClick={() => void handleImportWork()} tone="secondary" type="button">
              작품 snapshot 추가
            </AppButton>
            <DroppableZone id="pool">
              <Paper className={cn(css.pool)} p="sm">
                <Stack gap="xs">
                  <Text fw={700} size="sm">
                    미배치 카드
                  </Text>
                  <SortableContext items={poolCards.map((card) => card.id)}>
                    <Stack gap="xs">
                      {poolCards.map((card) => (
                        <SortableCard
                          assetUrls={assetUrls}
                          card={card}
                          key={card.id}
                          lanes={editorState.lanes}
                          onDelete={(id) => void handleDeleteCard(id)}
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

        <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)} sensors={sensors}>
          <Paper className={cn(css.canvas)} ref={boardRef}>
            <SortableContext items={editorState.lanes.map((lane) => lane.id)}>
              <ScrollArea type="auto">
                {editorState.lanes.map((lane) => (
                  <SortableLane
                    assetUrls={assetUrls}
                    cards={getCardsForLane(editorState.cards, lane.id)}
                    key={lane.id}
                    lane={lane}
                    lanes={editorState.lanes}
                    onDeleteItem={(id) => void handleDeleteCard(id)}
                    onDeleteLane={(id) => void handleDeleteLane(id)}
                    onMoveItem={(id, laneId) => void handleMoveCard(id, laneId)}
                    onMoveLane={(id, delta) => void handleMoveLane(id, delta)}
                    onUpdateLane={setLaneEditor}
                  />
                ))}
              </ScrollArea>
            </SortableContext>
          </Paper>
        </DndContext>
      </div>

      <Modal onClose={() => setSettingsOpen(false)} opened={settingsOpen} title="보드 설정">
        <Stack gap="md">
          <TextInput
            label="보드 제목"
            onBlur={(event) => void tierBoardService.updateBoard(activeBoardId, { title: event.currentTarget.value }).then(loadState)}
            defaultValue={editorState.board.title}
          />
          <Textarea
            autosize
            label="설명"
            minRows={2}
            onBlur={(event) => void tierBoardService.updateBoard(activeBoardId, { description: event.currentTarget.value }).then(loadState)}
            defaultValue={editorState.board.description}
          />
          <Select
            data={[
              { label: 'Classic tier', value: 'classic_tier' },
              { label: 'Ranking', value: 'ranking' },
              { label: 'Freeform', value: 'freeform' },
            ]}
            label="Board type"
            onChange={(value) =>
              value &&
              void tierBoardService
                .updateBoard(activeBoardId, { boardType: value as TierBoardType })
                .then(loadState)
            }
            value={editorState.board.boardType}
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
          <AppButton
            onClick={() =>
              void tierBoardService
                .createLane(activeBoardId, {
                  colorToken: '#64748b',
                  title: '새 행',
                })
                .then(loadState)
            }
            tone="primary"
            type="button"
          >
            Lane 추가
          </AppButton>
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
            <TextInput
              label="Color"
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
            <AppButton
              onClick={async () => {
                await tierBoardService.updateLane(laneEditor.id, laneEditor);
                setLaneEditor(null);
                await loadState();
              }}
              tone="primary"
              type="button"
            >
              저장
            </AppButton>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
