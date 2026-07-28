import { cn } from '@shared/utils/class-names';
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

import type {
  TierBoardRecord,
  TierBoardType,
} from '@work-archive/shared-types';
import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
  type AppTranslationKey,
} from '@app/i18n';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { ArchiveEmptyState, ArchiveHero } from '@features/works';
import {
  TIER_BOARD_TEMPLATES,
  tierBoardService,
} from '../services/tier-board.service';
import styles from './TierBoardsPage.module.css';

const css = styles;

function formatDate(value: string) {
  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function TemplatePreview({ templateTitle }: { templateTitle: string }) {
  const { t } = useAppTranslation();
  const template = TIER_BOARD_TEMPLATES.find(
    (candidate) =>
      getTemplateValue(candidate) === templateTitle ||
      candidate.title === templateTitle,
  );

  if (!template || template.lanes.length === 0) {
    return (
      <Box className={cn(css.templatePreview)}>
        <Text c="dimmed" size="xs">
          {t('tierBoards.emptyBoard')}
        </Text>
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
          {getTemplateText(lane.title, t)}
        </Box>
      ))}
    </Group>
  );
}

function TierBoardCoverPreview({ coverImageUrl }: { coverImageUrl: string }) {
  const [failed, setFailed] = useState(false);
  const displayImageUrl = getDisplayImageUrl(coverImageUrl);

  useEffect(() => {
    setFailed(false);
  }, [displayImageUrl]);

  if (!displayImageUrl || failed) {
    return <TemplatePreview templateTitle="S/A/B/C/D" />;
  }

  return (
    <img
      alt=""
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={displayImageUrl}
    />
  );
}

export function TierBoardsPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('tierBoards.pageTitle'));
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boards, setBoards] = useState<TierBoardRecord[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { cards: number; lanes: number }>
  >({});
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState<string>(t('tierBoards.newTitle'));
  const [description, setDescription] = useState('');
  const [templateTitle, setTemplateTitle] = useState<string>(
    getTemplateValue(TIER_BOARD_TEMPLATES[0]!),
  );
  const [boardType, setBoardType] = useState<TierBoardType>('classic_tier');
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [deletedSnapshot, setDeletedSnapshot] = useState<Awaited<
    ReturnType<typeof tierBoardService.deleteBoard>
  > | null>(null);

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
      setFeedback({ message: t('tierBoards.createSuccess'), tone: 'success' });
      setTitle(t('tierBoards.newTitle'));
      setDescription('');
      setTemplateTitle(getTemplateValue(TIER_BOARD_TEMPLATES[0]!));
      setBoardType('classic_tier');
      setCreateOpen(false);
      await loadBoards();
      navigate(`/tier-boards/${board.id}`);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('tierBoards.createError'),
        tone: 'error',
      });
    }
  }

  async function handleDuplicateBoard(id: string) {
    const board = await tierBoardService.duplicateBoard(id);
    setFeedback({ message: t('tierBoards.duplicateSuccess'), tone: 'success' });
    await loadBoards();
    navigate(`/tier-boards/${board.id}`);
  }

  async function handleDeleteBoard(id: string) {
    const board = boards.find((candidate) => candidate.id === id);

    if (
      !window.confirm(
        t('tierBoards.deleteConfirm', {
          title: board?.title ?? t('tierBoards.selectedBoard'),
        }),
      )
    ) {
      return;
    }

    const snapshot = await tierBoardService.deleteBoard(id);
    setDeletedSnapshot(snapshot);
    setFeedback({ message: t('tierBoards.deleteSuccess'), tone: 'success' });
    await loadBoards();
  }

  async function handleUndoDelete() {
    if (!deletedSnapshot) return;
    await tierBoardService.restoreBoardSnapshot(deletedSnapshot);
    setDeletedSnapshot(null);
    setFeedback({ message: t('tierBoards.restoreSuccess'), tone: 'success' });
    await loadBoards();
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;

    try {
      const board = await tierBoardService.importBoardJson(await file.text());
      setFeedback({
        message: t('tierBoards.importSuccess'),
        tone: 'success',
      });
      await loadBoards();
      navigate(`/tier-boards/${board.id}`);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('tierBoards.importError'),
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
            <AppButton
              onClick={() => setCreateOpen(true)}
              tone="primary"
              type="button"
            >
              {t('tierBoards.create')}
            </AppButton>
            <AppButton
              onClick={() => fileInputRef.current?.click()}
              tone="secondary"
              type="button"
            >
              {t('tierBoards.importJson')}
            </AppButton>
            <input
              accept="application/json,.json"
              hidden
              onChange={(event) =>
                void handleImportFile(event.currentTarget.files?.[0] ?? null)
              }
              ref={fileInputRef}
              type="file"
            />
          </Group>
        }
        description={t('tierBoards.heroDescription')}
        eyebrow="Tier Board Maker"
        title={t('tierBoards.heroTitle')}
        variant="compact"
      />

      {feedback && (
        <FeedbackMessage tone={feedback.tone}>
          <Group gap="sm" justify="space-between">
            <Text>{feedback.message}</Text>
            {deletedSnapshot && (
              <AppButton
                onClick={() => void handleUndoDelete()}
                tone="secondary"
                type="button"
              >
                {t('tierBoards.undo')}
              </AppButton>
            )}
          </Group>
        </FeedbackMessage>
      )}

      {boards.length === 0 ? (
        <ArchiveEmptyState
          actions={
            <Group gap="sm">
              <AppButton
                onClick={() => setCreateOpen(true)}
                tone="primary"
                type="button"
              >
                {t('tierBoards.create')}
              </AppButton>
              <AppButton
                onClick={() => fileInputRef.current?.click()}
                tone="secondary"
                type="button"
              >
                {t('tierBoards.importJson')}
              </AppButton>
            </Group>
          }
          description={t('tierBoards.emptyDescription')}
          eyebrow={t('tierBoards.pageTitle')}
          title={t('tierBoards.emptyTitle')}
        />
      ) : (
        <div className={cn(css.grid)}>
          {boards.map((board) => (
            <Paper className={cn(css.card)} key={board.id} p="lg">
              <Stack h="100%" justify="space-between">
                <Stack gap="sm">
                  <Box className={cn(css.coverPreview)}>
                    <TierBoardCoverPreview
                      coverImageUrl={board.coverImageUrl}
                    />
                  </Box>
                  <Group justify="space-between" wrap="nowrap">
                    <Title lineClamp={2} order={2} size="h3">
                      {board.title}
                    </Title>
                    <AppBadge
                      tone={board.visibility === 'exported' ? 'info' : 'muted'}
                    >
                      {t(`tierBoards.visibility.${board.visibility}`)}
                    </AppBadge>
                  </Group>
                  <Text c="dimmed" lineClamp={3} size="sm">
                    {board.description || t('tierBoards.noDescription')}
                  </Text>
                  <Group gap="xs">
                    <AppBadge tone="accent">
                      {t('tierBoards.laneCount', {
                        count: formatAppNumber(counts[board.id]?.lanes ?? 0),
                      })}
                    </AppBadge>
                    <AppBadge tone="muted">
                      {t('tierBoards.cardCount', {
                        count: formatAppNumber(counts[board.id]?.cards ?? 0),
                      })}
                    </AppBadge>
                  </Group>
                  <Text c="dimmed" size="xs">
                    {t('tierBoards.lastUpdated', {
                      date: formatDate(board.updatedAt),
                    })}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <AppLinkButton to={`/tier-boards/${board.id}`} tone="primary">
                    {t('tierBoards.open')}
                  </AppLinkButton>
                  <AppLinkButton
                    to={`/tier-boards/${board.id}/view`}
                    tone="secondary"
                  >
                    {t('tierBoards.view')}
                  </AppLinkButton>
                  <AppButton
                    onClick={() => void handleDuplicateBoard(board.id)}
                    tone="secondary"
                    type="button"
                  >
                    {t('tierBoards.duplicate')}
                  </AppButton>
                  <AppButton
                    onClick={() => void handleDeleteBoard(board.id)}
                    tone="quiet"
                    type="button"
                  >
                    {t('tierBoards.delete')}
                  </AppButton>
                </Group>
              </Stack>
            </Paper>
          ))}
        </div>
      )}

      <Modal
        onClose={() => setCreateOpen(false)}
        opened={createOpen}
        size="lg"
        title={t('tierBoards.createModalTitle')}
      >
        <Stack gap="md">
          <TextInput
            aria-label={t('tierBoards.createTitleAria')}
            label={t('tierBoards.titleLabel')}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <Textarea
            aria-label={t('tierBoards.createDescriptionAria')}
            autosize
            label={t('tierBoards.descriptionLabel')}
            minRows={2}
            onChange={(event) => setDescription(event.currentTarget.value)}
            value={description}
          />
          <Select
            data={[
              {
                label: t('tierBoards.boardType.classic_tier'),
                value: 'classic_tier',
              },
              { label: t('tierBoards.boardType.ranking'), value: 'ranking' },
              { label: t('tierBoards.boardType.freeform'), value: 'freeform' },
            ]}
            label={t('tierBoards.boardTypeLabel')}
            onChange={(value) => value && setBoardType(value as TierBoardType)}
            value={boardType}
          />
          <Stack gap="xs">
            <Text fw={700} size="sm">
              {t('tierBoards.templateLabel')}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {TIER_BOARD_TEMPLATES.map((template) => (
                <button
                  className={`${cn(css.templateCard)} ${templateTitle === getTemplateValue(template) ? cn(css.templateCardSelected) : ''}`}
                  key={getTemplateValue(template)}
                  onClick={() => setTemplateTitle(getTemplateValue(template))}
                  type="button"
                >
                  <Text fw={700} size="sm">
                    {getTemplateLabel(template, t)}
                  </Text>
                  <TemplatePreview templateTitle={getTemplateValue(template)} />
                </button>
              ))}
            </SimpleGrid>
          </Stack>
          <Group justify="flex-end">
            <AppButton
              onClick={() => setCreateOpen(false)}
              tone="quiet"
              type="button"
            >
              {t('common.cancel')}
            </AppButton>
            <AppButton
              onClick={() => void handleCreateBoard()}
              tone="primary"
              type="button"
            >
              {t('tierBoards.createSubmit')}
            </AppButton>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function getTemplateValue(template: { id?: string; title: string }) {
  return template.id ?? template.title;
}

function getTemplateLabel(
  template: { title: string; titleKey?: AppTranslationKey },
  t: (key: AppTranslationKey) => string,
) {
  return getTemplateText(template.titleKey ?? template.title, t);
}

function getTemplateText(value: string, t: (key: AppTranslationKey) => string) {
  return value.startsWith('tierBoards.templates.')
    ? t(value as AppTranslationKey)
    : value;
}
