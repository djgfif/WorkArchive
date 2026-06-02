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
import { CardImage } from './TierBoardCanvas';
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

function createWorkSubtitle(work: WorkRecord) {
  return [
    work.type,
    work.author,
    work.rating === null ? null : `★ ${work.rating.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');
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
              카드 추가
            </Title>
          </Stack>
          <AppBadge tone="muted">{cardCount}개</AppBadge>
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
                      이미지 선택
                    </Text>
                    <Text c="dimmed" size="xs">
                      jpg, png, webp · 5MB 이하
                    </Text>
                  </Stack>
                )}
              </Paper>
              {uploadError && (
                <FeedbackMessage tone="error">{uploadError}</FeedbackMessage>
              )}
              <Stack className={cn(css.addFieldGroup)} gap={6}>
                <TextInput
                  label="제목"
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setUploadDraft((draft) => ({
                      ...draft,
                      title: value,
                    }));
                  }}
                  placeholder="카드 제목"
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
                  title={urlDraft.title || '이미지 URL 미리보기'}
                />
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
              <AppButton
                disabled={!urlDraft.imageUrl.trim()}
                fullWidth
                onClick={onCreateUrlCard}
                tone="primary"
                type="button"
              >
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
              <AppButton
                fullWidth
                onClick={onCreateTextCard}
                tone="primary"
                type="button"
              >
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
                        Snapshot 추가
                      </AppButton>
                    </Group>
                  </Paper>
                ))}
                {filteredWorks.length === 0 && (
                  <Text c="dimmed" size="sm">
                    snapshot으로 가져올 작품이 없습니다.
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
