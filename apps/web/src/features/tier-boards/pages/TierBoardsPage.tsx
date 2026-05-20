import { useEffect, useRef, useState } from 'react';
import {
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import { ArchiveEmptyState, ArchiveHero } from '../../works/components/ArchiveComponents';
import { tierBoardService } from '../services/tier-board.service';
import type { TierBoardRecord } from '@work-archive/shared-types';
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

export function TierBoardsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boards, setBoards] = useState<TierBoardRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, { items: number; lanes: number }>>({});
  const [title, setTitle] = useState('새 티어보드');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [deletedSnapshot, setDeletedSnapshot] = useState<Awaited<ReturnType<typeof tierBoardService.deleteBoard>> | null>(null);

  async function loadBoards() {
    const nextBoards = await tierBoardService.listBoards();
    const nextCounts: Record<string, { items: number; lanes: number }> = {};

    await Promise.all(
      nextBoards.map(async (board) => {
        const state = await tierBoardService.getBoardEditorState(board.id);
        nextCounts[board.id] = {
          items: state?.items.length ?? 0,
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
      const board = await tierBoardService.createBoard({ description, title });
      setFeedback({ message: '티어보드를 만들었습니다.', tone: 'success' });
      setTitle('새 티어보드');
      setDescription('');
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
            <AppButton onClick={() => void handleCreateBoard()} tone="primary" type="button">
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
      >
        <Stack gap="sm">
          <Group align="flex-start" gap="sm" wrap="wrap">
            <TextInput
              aria-label="새 티어보드 제목"
              label="제목"
              onChange={(event) => setTitle(event.currentTarget.value)}
              value={title}
              w={260}
            />
            <Textarea
              aria-label="새 티어보드 설명"
              autosize
              label="설명"
              minRows={1}
              onChange={(event) => setDescription(event.currentTarget.value)}
              value={description}
              w={420}
            />
          </Group>
        </Stack>
      </ArchiveHero>

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
              <AppButton onClick={() => void handleCreateBoard()} tone="primary" type="button">
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
                    <AppBadge tone="muted">{counts[board.id]?.items ?? 0} items</AppBadge>
                  </Group>
                  <Text c="dimmed" size="xs">
                    마지막 수정 {formatDate(board.updatedAt)}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <AppLinkButton to={`/tier-boards/${board.id}`} tone="primary">
                    열기
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
    </Stack>
  );
}
