import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useParams } from 'react-router-dom';

import {
  AppBadge,
  AppButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import {
  TierBoardCardEditorModal,
  TierBoardLaneEditorModal,
  TierBoardSettingsModal,
} from '../components/TierBoardEditorDialogs';
import {
  CardTile,
  DroppableZone,
  SortableCard,
  SortableLane,
} from '../components/TierBoardCanvas';
import { TierBoardSourcePanel } from '../components/TierBoardSourcePanel';
import { useTierBoardEditorController } from '../hooks/useTierBoardEditorController';
import {
  getCardSortableId,
  getCardsForLane,
  getLaneSortableId,
  getPoolContainerId,
  tierBoardCollisionDetection,
} from '../utils/tier-board-editor-helpers';
import styles from './TierBoardsPage.module.css';

const css = styles as Record<string, string>;
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

export function TierBoardEditorPage() {
  const { boardId } = useParams();
  const controller = useTierBoardEditorController(boardId);

  if (!boardId || !controller.editorState) {
    return (
      <FeedbackMessage tone="info">
        티어보드를 불러오는 중입니다.
      </FeedbackMessage>
    );
  }

  const {
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
    navigateToBoards,
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
  } = controller;

  return (
    <Stack gap="md" py="lg">
      <Paper className={cn(css.toolbar)} p="md">
        <div className={cn(css.toolbarLayout)}>
          <Stack className={cn(css.toolbarIdentity)} gap={6}>
            <Group gap="xs" wrap="nowrap">
              <Title className={cn(css.toolbarTitle)} order={1}>
                {editorState.board.title}
              </Title>
              <AppBadge
                tone={
                  editorState.board.visibility === 'exported' ? 'info' : 'muted'
                }
              >
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
              onChange={(value) =>
                setCardTitleDisplay(value as 'visible' | 'hidden')
              }
              size="xs"
              value={cardTitleDisplay}
            />
            <AppButton
              onClick={() => void handleCreateLane()}
              size="xs"
              tone="secondary"
              type="button"
            >
              행 추가
            </AppButton>
            <AppButton
              aria-label="보드 설정"
              onClick={openSettings}
              size="xs"
              tone="secondary"
              type="button"
            >
              설정
            </AppButton>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <Button
                  className={cn(css.toolbarMenuButton)}
                  size="xs"
                  variant="default"
                >
                  내보내기
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => void handleExportPng()}>
                  {isExportingPng ? 'PNG 생성 중' : 'PNG 이미지'}
                </Menu.Item>
                <Menu.Item onClick={() => void handleCopyPng()}>
                  클립보드 복사
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => void handleExportJson()}>
                  JSON 파일
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  aria-label="보드 작업 더보기"
                  className={cn(css.toolbarIconButton)}
                  size="sm"
                  variant="default"
                >
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => void handleDuplicateBoard()}>
                  보드 복제
                </Menu.Item>
                <Menu.Item onClick={navigateToBoards}>목록으로 이동</Menu.Item>
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
                <AppButton
                  onClick={() => void handleUndoDeleteCard()}
                  tone="secondary"
                  type="button"
                >
                  카드 되돌리기
                </AppButton>
              )}
              {deletedLane && (
                <AppButton
                  onClick={() => void handleUndoDeleteLane()}
                  tone="secondary"
                  type="button"
                >
                  행 되돌리기
                </AppButton>
              )}
            </Group>
          </Group>
        </FeedbackMessage>
      )}

      <DndContext
        collisionDetection={tierBoardCollisionDetection}
        onDragCancel={handleDragCancel}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div
          className={cn(css.editorShell)}
          data-testid="tier-board-dnd-context"
        >
          <TierBoardSourcePanel
            cardCount={editorState.cards.length}
            filteredWorks={filteredWorks}
            onCreateTextCard={() => void handleCreateTextCard()}
            onCreateUrlCard={() => void handleCreateUrlCard()}
            onImportWork={(workId) => void handleImportWork(workId)}
            onUpload={() => void handleUpload()}
            onUploadFile={handleUploadFile}
            setTextDraft={setTextDraft}
            setUploadDraft={setUploadDraft}
            setUrlDraft={setUrlDraft}
            setWorkSearch={setWorkSearch}
            textDraft={textDraft}
            uploadDraft={uploadDraft}
            uploadError={uploadError}
            uploadFile={uploadFile}
            uploadInputRef={uploadInputRef}
            uploadPreviewUrl={uploadPreviewUrl}
            urlDraft={urlDraft}
            workSearch={workSearch}
          />

          <Stack className={cn(css.boardWorkspace)} gap="md">
            <Paper className={cn(css.canvas)} ref={boardRef}>
              <SortableContext
                items={editorState.lanes.map((lane) =>
                  getLaneSortableId(lane.id),
                )}
                strategy={rectSortingStrategy}
              >
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
                      onMoveCard={(id, laneId) =>
                        void handleMoveCard(id, laneId)
                      }
                      onMoveLane={(id, delta) => void handleMoveLane(id, delta)}
                      onUpdateLane={(lane) => setLaneEditor({ ...lane })}
                      showCardTitles={showCardTitles}
                    />
                  ))}
                </ScrollArea>
              </SortableContext>
            </Paper>

            <Paper className={cn(css.pool)} p="sm">
              <DroppableZone
                className={cn(css.poolDropZone)}
                id={getPoolContainerId()}
              >
                <Stack gap="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={800} size="sm">
                      미배치 카드
                    </Text>
                    <AppBadge tone="muted">{poolCards.length}개</AppBadge>
                  </Group>
                  <SortableContext
                    items={poolCards.map((card) => getCardSortableId(card.id))}
                    strategy={rectSortingStrategy}
                  >
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
                          onMove={(id, laneId) =>
                            void handleMoveCard(id, laneId)
                          }
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
            <CardTile
              assetUrls={assetUrls}
              card={activeDragCard}
              isOverlay
              showTitle={showCardTitles}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TierBoardSettingsModal
        onApplyLaneTemplate={(templateTitle) =>
          void handleApplyLaneTemplate(templateTitle)
        }
        onClose={() => setSettingsOpen(false)}
        onCreateLane={() => void handleCreateLane()}
        onSave={() => void saveSettings()}
        opened={settingsOpen}
        setSettingsDraft={setSettingsDraft}
        settingsDraft={settingsDraft}
      />
      <TierBoardLaneEditorModal
        laneEditor={laneEditor}
        onClose={() => setLaneEditor(null)}
        onSave={() => void saveLaneEditor()}
        setLaneEditor={setLaneEditor}
      />
      <TierBoardCardEditorModal
        cardEditor={cardEditor}
        onClose={() => setCardEditor(null)}
        onSave={() => void saveCardEditor()}
        setCardEditor={setCardEditor}
      />
    </Stack>
  );
}
