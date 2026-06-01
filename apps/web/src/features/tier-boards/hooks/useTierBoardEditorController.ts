import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toBlob, toPng } from 'html-to-image';
import { useNavigate } from 'react-router-dom';

import type {
  TierBoardCardRecord,
  TierBoardType,
  TierBoardVisibility,
  TierLaneRecord,
  WorkRecord,
} from '@work-archive/shared-types';
import { worksRepository } from '@features/works';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import {
  tierBoardService,
  type TierLaneDeleteSnapshot,
} from '../services/tier-board.service';
import type { TierBoardSettingsDraft } from '../components/TierBoardEditorDialogs';
import {
  applyCardMovePreview,
  applyCardOrderPreview,
  applyLaneOrderPreview,
  downloadDataUrl,
  downloadText,
  getCardsForLane,
  parseCardSortableId,
  parseDropLaneId,
  parseLaneSortableId,
} from '../utils/tier-board-editor-helpers';

type FeedbackState = {
  message: string;
  tone: 'error' | 'success';
} | null;

export function useTierBoardEditorController(boardId: string | undefined) {
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<TierBoardEditorState | null>(null);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<TierBoardSettingsDraft>({
    boardType: 'classic_tier' as TierBoardType,
    description: '',
    title: '',
    visibility: 'private' as TierBoardVisibility,
  });
  const [laneEditor, setLaneEditor] = useState<TierLaneRecord | null>(null);
  const [cardEditor, setCardEditor] = useState<TierBoardCardRecord | null>(
    null,
  );
  const [textDraft, setTextDraft] = useState({
    note: '',
    subtitle: '',
    title: '',
  });
  const [urlDraft, setUrlDraft] = useState({
    imageUrl: '',
    note: '',
    subtitle: '',
    title: '',
  });
  const [uploadDraft, setUploadDraft] = useState({
    note: '',
    subtitle: '',
    title: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [workSearch, setWorkSearch] = useState('');
  const [deletedCard, setDeletedCard] = useState<TierBoardCardRecord | null>(
    null,
  );
  const [deletedLane, setDeletedLane] = useState<TierLaneDeleteSnapshot | null>(
    null,
  );
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [cardTitleDisplay, setCardTitleDisplay] = useState<
    'visible' | 'hidden'
  >('visible');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeBoardId = boardId ?? '';
  const editorState = state;
  const showCardTitles = cardTitleDisplay === 'visible';

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
          ? `${work.title} ${work.author} ${work.type}`
              .toLowerCase()
              .includes(query)
          : true,
      )
      .slice(0, 20);
  }, [workSearch, works]);
  const poolCards = useMemo(
    () => getCardsForLane(editorState?.cards ?? [], null),
    [editorState?.cards],
  );
  const activeDragCardId = activeDragId
    ? parseCardSortableId(activeDragId)
    : null;
  const activeDragCard = activeDragCardId
    ? (editorState?.cards.find(
        (candidate) => candidate.id === activeDragCardId,
      ) ?? null)
    : null;

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

  async function refreshWithSuccess(message: string) {
    setFeedback({ message, tone: 'success' });
    await loadState();
  }

  async function handleCreateTextCard() {
    if (!activeBoardId) return;
    await tierBoardService.createCustomTextCard(activeBoardId, {
      note: textDraft.note,
      subtitle: textDraft.subtitle,
      title: textDraft.title || '텍스트 카드',
    });
    setTextDraft({ note: '', subtitle: '', title: '' });
    await refreshWithSuccess('텍스트 카드를 추가했습니다.');
  }

  async function handleCreateUrlCard() {
    if (!activeBoardId) return;
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
    if (
      !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
        file.type,
      )
    ) {
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
    if (!uploadFile || !activeBoardId) return;
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
    if (!activeBoardId) return;
    await tierBoardService.createCardFromWorkSnapshot(activeBoardId, workId);
    await refreshWithSuccess('작품에서 가져온 snapshot 카드를 추가했습니다.');
  }

  async function handleMoveCard(id: string, laneId: string | null) {
    if (!activeBoardId) return;
    if (laneId) await tierBoardService.moveCardToLane(id, laneId);
    else await tierBoardService.removeCardFromLane(id);
    await refreshWithSuccess('카드 위치를 저장했습니다.');
  }

  async function handleDeleteCard(id: string) {
    if (!editorState) return;
    const card = editorState.cards.find((candidate) => candidate.id === id);

    if (
      card &&
      (card.cardSourceType === 'image_upload' || card.note.trim()) &&
      !window.confirm(
        '이 카드는 이미지 또는 메모가 있습니다. 삭제 후 되돌릴 수 있지만 계속할까요?',
      )
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
    if (!editorState) return;
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
    if (!editorState || !activeBoardId) return;
    const laneIds = editorState.lanes.map((lane) => lane.id);
    const index = laneIds.indexOf(id);
    const nextIndex = Math.max(0, Math.min(laneIds.length - 1, index + delta));

    if (index === nextIndex) return;
    await tierBoardService.reorderLane(
      activeBoardId,
      arrayMove(laneIds, index, nextIndex),
    );
    await refreshWithSuccess('행 순서를 저장했습니다.');
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDragId(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!editorState || !activeBoardId) return;
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

      const activeCard = editorState.cards.find(
        (candidate) => candidate.id === activeCardId,
      );
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
            ? applyCardOrderPreview(
                current,
                activeCardId,
                targetLaneId,
                nextIds,
              )
            : current,
        );
        await tierBoardService.reorderCard(
          activeBoardId,
          targetLaneId,
          nextIds,
        );
      } else if (activeCard.laneId !== targetLaneId) {
        setState((current) =>
          current && current.board.id === activeBoardId
            ? applyCardMovePreview(current, activeCardId, targetLaneId)
            : current,
        );
        if (targetLaneId) {
          await tierBoardService.moveCardToLane(activeCardId, targetLaneId);
        } else {
          await tierBoardService.removeCardFromLane(activeCardId);
        }
      }

      await loadState();
    } finally {
      setActiveDragId(null);
    }
  }

  async function handleExportJson() {
    if (!editorState || !activeBoardId) return;
    const exported = await tierBoardService.exportBoardJson(activeBoardId);
    downloadText(
      `${editorState.board.title}.tier-board.json`,
      JSON.stringify(exported, null, 2),
    );
    await tierBoardService.updateBoard(activeBoardId, {
      visibility: 'exported',
    });
    await refreshWithSuccess('JSON 파일로 내보냈습니다.');
  }

  async function handleExportPng() {
    if (!editorState || !boardRef.current || isExportingPng) return;
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
        message:
          'PNG 내보내기에 실패했습니다. 외부 이미지 CORS 때문에 실패했을 수 있습니다.',
        tone: 'error',
      });
    } finally {
      setIsExportingPng(false);
    }
  }

  async function handleCopyPng() {
    if (
      !boardRef.current ||
      !navigator.clipboard ||
      !('ClipboardItem' in window)
    ) {
      return;
    }
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
      setFeedback({
        message: '클립보드에 이미지로 복사했습니다.',
        tone: 'success',
      });
    } catch {
      setFeedback({
        message:
          '클립보드 복사에 실패했습니다. 외부 이미지 CORS 때문에 실패했을 수 있습니다.',
        tone: 'error',
      });
    }
  }

  function openSettings() {
    if (!editorState) return;
    setSettingsDraft({
      boardType: editorState.board.boardType,
      description: editorState.board.description,
      title: editorState.board.title,
      visibility: editorState.board.visibility,
    });
    setSettingsOpen(true);
  }

  async function saveSettings() {
    if (!activeBoardId) return;
    await tierBoardService.updateBoard(activeBoardId, settingsDraft);
    setSettingsOpen(false);
    await loadState();
  }

  async function handleCreateLane() {
    if (!activeBoardId) return;
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

  async function handleApplyLaneTemplate(templateTitle: string) {
    if (!activeBoardId) return;
    await tierBoardService.applyLaneTemplate(activeBoardId, templateTitle);
    await loadState();
  }

  async function handleDuplicateBoard() {
    if (!activeBoardId) return;
    const duplicated = await tierBoardService.duplicateBoard(activeBoardId);
    navigate(`/tier-boards/${duplicated.id}`);
  }

  return {
    activeBoardId,
    activeDragCard,
    assetUrls,
    boardRef,
    cardEditor,
    cardTitleDisplay,
    deletedCard,
    deletedLane,
    editorState,
    feedback,
    filteredWorks,
    handleApplyLaneTemplate,
    handleCopyPng,
    handleCreateLane,
    handleCreateTextCard,
    handleCreateUrlCard,
    handleDeleteCard,
    handleDeleteLane,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    handleDuplicateBoard,
    handleDuplicateCard,
    handleExportJson,
    handleExportPng,
    handleImportWork,
    handleMoveCard,
    handleMoveLane,
    handleUndoDeleteCard,
    handleUndoDeleteLane,
    handleUpload,
    handleUploadFile,
    isExportingPng,
    laneEditor,
    loadState,
    navigateToBoards: () => navigate('/tier-boards'),
    openSettings,
    poolCards,
    saveCardEditor,
    saveLaneEditor,
    saveSettings,
    sensors,
    setCardEditor,
    setCardTitleDisplay,
    setLaneEditor,
    setSettingsDraft,
    setSettingsOpen,
    setTextDraft,
    setUploadDraft,
    setUrlDraft,
    setWorkSearch,
    settingsDraft,
    settingsOpen,
    showCardTitles,
    textDraft,
    uploadDraft,
    uploadError,
    uploadFile,
    uploadInputRef,
    uploadPreviewUrl,
    urlDraft,
    workSearch,
  };
}
