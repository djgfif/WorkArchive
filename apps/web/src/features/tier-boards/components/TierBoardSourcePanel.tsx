import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  Box,
  Group,
  Paper,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';
import {
  AppBadge,
  AppButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import { formatAppNumber, useAppTranslation } from '@app/i18n';
import { CardImage } from './TierBoardCanvas';
import { createWorkSubtitle } from '../services/tier-board-records';
import styles from '../pages/TierBoardsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface CardDraft {
  note: string;
  subtitle: string;
  title: string;
}

interface UrlCardDraft extends CardDraft {
  imageUrl: string;
}

interface TierBoardSourcePanelProps {
  cardCount: number;
  filteredWorks: WorkRecord[];
  onCreateTextCard: () => void;
  onCreateUrlCard: () => void;
  onImportWork: (workId: string) => void;
  onUpload: () => void;
  onUploadFile: (file: File | null) => void;
  setTextDraft: Dispatch<SetStateAction<CardDraft>>;
  setUploadDraft: Dispatch<SetStateAction<CardDraft>>;
  setUrlDraft: Dispatch<SetStateAction<UrlCardDraft>>;
  setWorkSearch: Dispatch<SetStateAction<string>>;
  textDraft: CardDraft;
  uploadDraft: CardDraft;
  uploadError: string;
  uploadFile: File | null;
  uploadInputRef: MutableRefObject<HTMLInputElement | null>;
  uploadPreviewUrl: string;
  urlDraft: UrlCardDraft;
  workSearch: string;
}


export function TierBoardSourcePanel({
  cardCount,
  filteredWorks,
  onCreateTextCard,
  onCreateUrlCard,
  onImportWork,
  onUpload,
  onUploadFile,
  setTextDraft,
  setUploadDraft,
  setUrlDraft,
  setWorkSearch,
  textDraft,
  uploadDraft,
  uploadError,
  uploadFile,
  uploadInputRef,
  uploadPreviewUrl,
  urlDraft,
  workSearch,
}: TierBoardSourcePanelProps) {
  const { t } = useAppTranslation();

  return (
    <Paper className={cn(css.sourcePanel)} p="md">
      <Stack gap="md">
        <Group
          className={cn(css.sourcePanelHeader)}
          justify="space-between"
          wrap="nowrap"
        >
          <Stack gap={2}>
            <Text className={cn(css.sourcePanelEyebrow)} size="xs">
              Quick add
            </Text>
            <Title order={2} size="h4">
              {t('tierBoards.source.title')}
            </Title>
          </Stack>
          <AppBadge tone="muted">
            {t('tierBoards.source.cardCount', {
              count: formatAppNumber(cardCount),
            })}
          </AppBadge>
        </Group>
        <Tabs className={cn(css.addTabs)} defaultValue="upload">
          <Tabs.List className={cn(css.addTabsList)} grow>
            <Tabs.Tab value="upload">{t('tierBoards.source.upload')}</Tabs.Tab>
            <Tabs.Tab value="url">{t('tierBoards.source.imageUrl')}</Tabs.Tab>
            <Tabs.Tab value="text">{t('tierBoards.source.text')}</Tabs.Tab>
            <Tabs.Tab value="work">{t('tierBoards.source.fromWork')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel pt="md" value="upload">
            <Stack className={cn(css.addForm)} gap="sm">
              <input
                accept="image/jpeg,image/jpg,image/png,image/webp"
                hidden
                onChange={(event) =>
                  onUploadFile(event.currentTarget.files?.[0] ?? null)
                }
                ref={uploadInputRef}
                type="file"
              />
              <Paper
                className={cn(css.quickAddDropzone)}
                onClick={() => uploadInputRef.current?.click()}
                p="md"
                role="button"
                tabIndex={0}
              >
                {uploadFile ? (
                  <Stack gap="xs">
                    <CardImage
                      imageUrl={uploadPreviewUrl}
                      title={uploadFile.name}
                    />
                    <Text c="dimmed" lineClamp={1} size="xs">
                      {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)}{' '}
                      KB
                    </Text>
                  </Stack>
                ) : (
                  <Stack align="center" gap={4}>
                    <Text fw={800} size="sm">
                      {t('tierBoards.source.selectImage')}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {t('tierBoards.source.imageHelp')}
                    </Text>
                  </Stack>
                )}
              </Paper>
              {uploadError && (
                <FeedbackMessage tone="error">{uploadError}</FeedbackMessage>
              )}
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label={t('tierBoards.titleLabel')}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setUploadDraft((draft) => ({
                      ...draft,
                      title: value,
                    }));
                  }}
                  placeholder={t('tierBoards.source.cardTitlePlaceholder')}
                  value={uploadDraft.title}
                />
              </Stack>
              <AppButton
                disabled={!uploadFile}
                fullWidth
                onClick={onUpload}
                tone="primary"
                type="button"
              >
                {t('tierBoards.source.addCard')}
              </AppButton>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="url">
            <Stack className={cn(css.addForm)} gap="sm">
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label={t('tierBoards.source.imageUrl')}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setUrlDraft((draft) => ({
                      ...draft,
                      imageUrl: value,
                    }));
                  }}
                  placeholder="https://..."
                  value={urlDraft.imageUrl}
                />
              </Stack>
              <Paper className={cn(css.quickAddPreview)} p="xs">
                <CardImage
                  imageUrl={urlDraft.imageUrl}
                  title={urlDraft.title || t('tierBoards.source.imagePreview')}
                />
              </Paper>
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label={t('tierBoards.titleLabel')}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setUrlDraft((draft) => ({ ...draft, title: value }));
                  }}
                  placeholder={t('tierBoards.source.cardTitlePlaceholder')}
                  value={urlDraft.title}
                />
              </Stack>
              <AppButton
                disabled={!urlDraft.imageUrl.trim()}
                fullWidth
                onClick={onCreateUrlCard}
                tone="primary"
                type="button"
              >
                {t('tierBoards.source.addCard')}
              </AppButton>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="text">
            <Stack className={cn(css.addForm)} gap="sm">
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label={t('tierBoards.titleLabel')}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setTextDraft((draft) => ({ ...draft, title: value }));
                  }}
                  placeholder={t('tierBoards.source.textTitlePlaceholder')}
                  value={textDraft.title}
                />
              </Stack>
              <Paper className={cn(css.quickTextPreview)} p="md">
                <Text fw={800} lineClamp={2} size="sm">
                  {textDraft.title || t('tierBoards.source.textCard')}
                </Text>
              </Paper>
              <AppButton
                fullWidth
                onClick={onCreateTextCard}
                tone="primary"
                type="button"
              >
                {t('tierBoards.source.addCard')}
              </AppButton>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="work">
            <Stack className={cn(css.addForm)} gap="sm">
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label={t('tierBoards.source.fromWorkLabel')}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setWorkSearch(value);
                  }}
                  placeholder={t('tierBoards.source.workSearchPlaceholder')}
                  value={workSearch}
                />
              </Stack>
              <Stack className={cn(css.workResultList)} gap="xs">
                {filteredWorks.map((work) => (
                  <Paper
                    className={cn(css.workResult)}
                    key={work.id}
                    p="sm"
                    withBorder
                  >
                    <Group align="center" gap="sm" wrap="nowrap">
                      <Box className={cn(css.workThumb)}>
                        <CardImage
                          imageUrl={work.thumbnailUrl}
                          title={work.title}
                        />
                      </Box>
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text fw={700} lineClamp={1} size="sm">
                          {work.title}
                        </Text>
                        <Text c="dimmed" lineClamp={1} size="xs">
                          {createWorkSubtitle(work)}
                        </Text>
                      </Stack>
                      <AppButton
                        onClick={() => onImportWork(work.id)}
                        tone="secondary"
                        type="button"
                      >
                        {t('tierBoards.source.addAsCard')}
                      </AppButton>
                    </Group>
                  </Paper>
                ))}
                {filteredWorks.length === 0 && (
                  <Text c="dimmed" size="sm">
                    {t('tierBoards.source.noWorks')}
                  </Text>
                )}
              </Stack>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Paper>
  );
}
