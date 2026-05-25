import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface WorksTrashListProps {
  onRestore: (work: WorkRecord) => Promise<void>;
  restoringWorkId: string | null;
  works: WorkRecord[];
}

export function WorksTrashList({
  onRestore,
  restoringWorkId,
  works,
}: WorksTrashListProps) {
  return (
    <section aria-label="휴지통 작품 목록">
      <Stack gap="md">
        {works.map((work) => {
          const isRestoring = restoringWorkId === work.id;
          const typeLabel = getWorkTypeLabel(work.type);

          return (
            <Paper
              className={cn(css.listRowSurface)}
              key={work.id}
              radius="lg"
              style={{
                opacity: isRestoring ? 0.78 : 1,
              }}
              withBorder
            >
              <Group align="flex-start" gap="md" justify="space-between" wrap="wrap">
                <Group
                  align="flex-start"
                  className={cn(css.listRowMain)}
                  gap="md"
                  miw={0}
                  wrap="nowrap"
                >
                  <Link
                    aria-label={`${work.title} 상세 보기`}
                    style={{ flexShrink: 0, display: 'block' }}
                    to={`/works/${work.id}`}
                  >
                    <WorkPoster
                      thumbnailUrl={work.thumbnailUrl}
                      title={work.title}
                      typeLabel={typeLabel}
                      variant="row"
                    />
                  </Link>

                  <Stack flex={1} gap={6} miw={0} pt={2}>
                    <Group gap={6} wrap="wrap">
                      <AppBadge tone="muted">{typeLabel}</AppBadge>
                      <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                      <AppBadge>{getWorkSyncStatusLabel(work.syncStatus)}</AppBadge>
                      {isRestoring && <AppBadge tone="accent">복원 중</AppBadge>}
                    </Group>

                    <Title lineClamp={1} order={3} size="h4">
                      <Link
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        to={`/works/${work.id}`}
                      >
                        {work.title}
                      </Link>
                    </Title>

                    <Text c="dimmed" lineClamp={1} size="xs">
                      {work.author || '작가·제작자 미입력'}
                      {' · 삭제한 날 '}
                      {formatWorkDateTime(work.deletedAt ?? work.updatedAt)}
                    </Text>

                    <Text c="var(--mantine-color-text)" lineClamp={2}>
                      {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
                    </Text>
                  </Stack>
                </Group>

                <Stack className={cn(css.listRowControls)} gap="xs">
                  <ActionRow justify="flex-end">
                    <AppButton
                      disabled={isRestoring}
                      onClick={() => void onRestore(work)}
                      size="compact-sm"
                      tone="primary"
                      type="button"
                    >
                      {isRestoring ? '복원 중...' : '복원'}
                    </AppButton>
                    <AppLinkButton
                      size="compact-sm"
                      to={`/works?q=${encodeURIComponent(work.title)}`}
                      tone="quiet"
                    >
                      비슷한 기록 보기
                    </AppLinkButton>
                  </ActionRow>
                  <Text c="dimmed" size="xs" ta="right">
                    복원하면 작품 목록으로 돌아갑니다.
                  </Text>
                </Stack>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    </section>
  );
}
