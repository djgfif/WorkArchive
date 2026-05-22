import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import type { TierBoardRecord, TierBoardType } from '@work-archive/shared-types';
import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import { ArchiveEmptyState, ArchiveHero } from '../../works';
import { TIER_BOARD_TEMPLATES, tierBoardService } from '../services/tier-board.service';
import styles from './TierBoardsPage.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function TemplatePreview({ templateTitle }: { templateTitle: string }) {
  const template = TIER_BOARD_TEMPLATES.find((candidate) => candidate.title === templateTitle);

  if (!template || template.lanes.length === 0) {
    return (
      <Box className={cn(css.templatePreview)}>
        <Text c="dimmed" size="xs">빈 보드</Text>
      </Box>
    );
  }

  return (
    <Group className={cn(css.templatePreview)} gap={4} wrap="nowrap">
      {template.lanes.map((lane) => (
        <Box
          className={cn(css.templateLane)}
          key={`${template.title}-${lane.title}`}
          style={{ backgroundColor: lane.colorToken }}
        >
          {lane.title}
        </Box>
      ))}
    </Group>
  );
}

export function TierBoardsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boards, setBoards] = useState<TierBoardRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, { cards: number; lanes: number }>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('새 티어보드');
  const [description, setDescription] = useState('');
  const [templateTitle, setTemplateTitle] = useState<string>(TIER_BOARD_TEMPLATES[0]!.title);
  const [boardType, setBoardType] = useState<TierBoardType>('classic_tier');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [deletedSnapshot, setDeletedSnapshot] = useState<Awaited<ReturnType<typeof tierBoardService.deleteBoard>> | null>(null);

  async function loadBoards() {
    const nextBoards = await tierBoardService.listBoards();
    const nextCounts: Record<string, { cards: number; lanes: number }> = {};

    await Promise.all(
      nextBoards.map(async (board) => {
        const state = await tierBoardService.getBoardEditorState(board.id);
        nextCounts[board.id] = {
          cards: state?.cards.length ?? 0,
          lanes: state?.lanes.length ?? 0,
        };
      }),
    );
    setBoards(nextBoards);
    setCounts(nextCounts);
  }

  useEffect(() => {
    void loadBoards();
  }, []);

  async function handleCreateBoard() {
    try {
      const board = await tierBoardService.createBoard({
        boardType,
        description,
        templateTitle,
        title,
      });
      setFeedback({ message: '티어보드를 만들었습니다.', tone: 'success' });
      setTitle('새 티어보드');
      setDescription('');
      setTemplateTitle(TIER_BOARD_TEMPLATES[0]!.title);
      setBoardType('classic_tier');
      setCreateOpen(false);
      await loadBoards();
      navigate(`/tier-boards/${board.id}`);
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : '티어보드를 만들지 못했습니다.',
        tone: 'error',
      });
    }
  }

  async function handleDuplicateBoard(id: string) {
    const board = await tierBoardService.duplicateBoard(id);
    setFeedback({ message: '티어보드를 복제했습니다.', tone: 'success' });
    await loadBoards();
    navigate(`/tier-boards/${board.id}`);
  }

  async function handleDeleteBoard(id: string) {
    const board = boards.find((candidate) => candidate.id === id);

    if (!window.confirm(`"${board?.title ?? '선택한 보드'}" 티어보드를 삭제할까요? 삭제 후 되돌릴 수 있습니다.`)) {
      return;
    }

    const snapshot = await tierBoardService.deleteBoard(id);
    setDeletedSnapshot(snapshot);
    setFeedback({ message: '티어보드를 삭제했습니다.', tone: 'success' });
    await loadBoards();
  }

  async function handleUndoDelete() {
    if (!deletedSnapshot) return;
    await tierBoardService.restoreBoardSnapshot(deletedSnapshot);
    setDeletedSnapshot(null);
    setFeedback({ message: '티어보드를 복원했습니다.', tone: 'success' });
    await loadBoards();
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;

    try {
      const board = await tierBoardService.importBoardJson(await file.text());
      setFeedback({ message: 'JSON 티어보드를 가져왔습니다.', tone: 'success' });
      await loadBoards();
      navigate(`/tier-boards/${board.id}`);
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'JSON을 가져오지 못했습니다.',
        tone: 'error',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <Stack className={cn(css.page)} gap="xl">
      <ArchiveHero
        actions={
          <Group gap="sm" wrap="wrap">
            <AppButton onClick={() => setCreateOpen(true)} tone="primary" type="button">
              새 티어보드 만들기
            </AppButton>
            <AppButton onClick={() => fileInputRef.current?.click()} tone="secondary" type="button">
              JSON 보드 가져오기
            </AppButton>
            <input
              accept="application/json,.json"
              hidden
              onChange={(event) => void handleImportFile(event.currentTarget.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
          </Group>
        }
        description="작품 기록과 분리된 자유형 보드를 만들고, 작품/캐릭터/이미지/텍스트 항목을 원하는 행에 배치하세요."
        eyebrow="Tier Board Maker"
        title="자유형 티어보드"
        variant="compact"
      />

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          <Group gap="sm" justify="space-between">
            <Text>{feedback.message}</Text>
            {deletedSnapshot && (
              <AppButton onClick={() => void handleUndoDelete()} tone="secondary" type="button">
                되돌리기
              </AppButton>
            )}
          </Group>
        </FeedbackMessage>
      )}

      {boards.length === 0 ? (
        <ArchiveEmptyState
          actions={
            <Group gap="sm">
              <AppButton onClick={() => setCreateOpen(true)} tone="primary" type="button">
                새 티어보드 만들기
              </AppButton>
              <AppButton onClick={() => fileInputRef.current?.click()} tone="secondary" type="button">
                JSON 보드 가져오기
              </AppButton>
            </Group>
          }
          description="작품 목록과 별개로 원하는 기준의 티어보드를 만들 수 있습니다."
          eyebrow="티어보드"
          title="아직 만든 티어보드가 없습니다."
        />
      ) : (
        <div className={cn(css.grid)}>
          {boards.map((board) => (
            <Paper className={cn(css.card)} key={board.id} p="lg">
              <Stack h="100%" justify="space-between">
                <Stack gap="sm">
                  <Box className={cn(css.coverPreview)}>
                    {board.coverImageUrl ? (
                      <img alt="" crossOrigin="anonymous" src={board.coverImageUrl} />
                    ) : (
                      <TemplatePreview templateTitle="S/A/B/C/D" />
                    )}
                  </Box>
                  <Group justify="space-between" wrap="nowrap">
                    <Title lineClamp={2} order={2} size="h3">
                      {board.title}
                    </Title>
                    <AppBadge tone={board.visibility === 'exported' ? 'info' : 'muted'}>
                      {board.visibility}
                    </AppBadge>
                  </Group>
                  <Text c="dimmed" lineClamp={3} size="sm">
                    {board.description || '설명 없음'}
                  </Text>
                  <Group gap="xs">
                    <AppBadge tone="accent">{counts[board.id]?.lanes ?? 0} lanes</AppBadge>
                    <AppBadge tone="muted">{counts[board.id]?.cards ?? 0} cards</AppBadge>
                  </Group>
                  <Text c="dimmed" size="xs">
                    마지막 수정 {formatDate(board.updatedAt)}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <AppLinkButton to={`/tier-boards/${board.id}`} tone="primary">
                    열기
                  </AppLinkButton>
                  <AppLinkButton to={`/tier-boards/${board.id}/view`} tone="secondary">
                    보기
                  </AppLinkButton>
                  <AppButton onClick={() => void handleDuplicateBoard(board.id)} tone="secondary" type="button">
                    복제
                  </AppButton>
                  <AppButton onClick={() => void handleDeleteBoard(board.id)} tone="quiet" type="button">
                    삭제
                  </AppButton>
                </Group>
              </Stack>
            </Paper>
          ))}
        </div>
      )}

      <Modal onClose={() => setCreateOpen(false)} opened={createOpen} size="lg" title="새 티어보드 만들기">
        <Stack gap="md">
          <TextInput
            aria-label="새 티어보드 제목"
            label="제목"
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <Textarea
            aria-label="새 티어보드 설명"
            autosize
            label="설명"
            minRows={2}
            onChange={(event) => setDescription(event.currentTarget.value)}
            value={description}
          />
          <Select
            data={[
              { label: 'Classic tier', value: 'classic_tier' },
              { label: 'Ranking', value: 'ranking' },
              { label: 'Freeform', value: 'freeform' },
            ]}
            label="보드 타입"
            onChange={(value) => value && setBoardType(value as TierBoardType)}
            value={boardType}
          />
          <Stack gap="xs">
            <Text fw={700} size="sm">템플릿</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {TIER_BOARD_TEMPLATES.map((template) => (
                <button
                  className={`${cn(css.templateCard)} ${templateTitle === template.title ? cn(css.templateCardSelected) : ''}`}
                  key={template.title}
                  onClick={() => setTemplateTitle(template.title)}
                  type="button"
                >
                  <Text fw={700} size="sm">{template.title}</Text>
                  <TemplatePreview templateTitle={template.title} />
                </button>
              ))}
            </SimpleGrid>
          </Stack>
          <Group justify="flex-end">
            <AppButton onClick={() => setCreateOpen(false)} tone="quiet" type="button">
              취소
            </AppButton>
            <AppButton onClick={() => void handleCreateBoard()} tone="primary" type="button">
              만들기
            </AppButton>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
