import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

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
    <section>
      <Paper
        p={0}
        radius="lg"
        styles={{
          root: {
            backgroundColor: 'var(--app-surface-0)',
            borderColor: 'var(--app-border-color)',
            overflow: 'hidden',
          },
        }}
        withBorder
      >
        <Stack gap={0}>
          {works.map((work, index) => {
            const isRestoring = restoringWorkId === work.id;
            const typeLabel = getWorkTypeLabel(work.type);

            return (
              <Box
                key={work.id}
                px="lg"
                py="lg"
                style={{
                  backgroundColor: isRestoring ? 'var(--app-surface-1)' : 'transparent',
                  borderBottom:
                    index === works.length - 1 ? 'none' : '1px solid var(--app-border-color)',
                }}
              >
                <Group align="flex-start" gap="lg" justify="space-between" wrap="wrap">
                  <Group align="flex-start" gap="md" miw={0} wrap="nowrap">
                    <ArtworkPoster
                      thumbnailUrl={work.thumbnailUrl}
                      title={work.title}
                      typeLabel={typeLabel}
                      variant="row"
                    />

                    <Stack gap="sm" miw={0}>
                      <ActionRow>
                        <AppBadge>{typeLabel}</AppBadge>
                        <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                        <AppBadge>{getWorkSyncStatusLabel(work.syncStatus)}</AppBadge>
                        {isRestoring && <AppBadge tone="accent">복원 중</AppBadge>}
                      </ActionRow>

                      <div>
                        <Title order={3}>
                          <Link
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            to={`/works/${work.id}`}
                          >
                            {work.title}
                          </Link>
                        </Title>
                        <Text c="var(--app-text-muted)">
                          {work.author || '작가·제작자 미입력'} · 삭제한 날{' '}
                          {formatWorkDateTime(work.deletedAt ?? work.updatedAt)}
                        </Text>
                      </div>

                      <Text c="var(--app-text-secondary)">
                        {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
                      </Text>
                    </Stack>
                  </Group>

                  <Stack gap="sm" style={{ flex: '1 1 16rem', minWidth: 'min(100%, 16rem)' }}>
                    <ActionRow justify="flex-end">
                      <AppButton
                        disabled={isRestoring}
                        onClick={() => void onRestore(work)}
                        tone="primary"
                        type="button"
                      >
                        {isRestoring ? '복원 중...' : '복원'}
                      </AppButton>
                      <AppLinkButton to={`/works?q=${encodeURIComponent(work.title)}`} tone="quiet">
                        비슷한 기록 보기
                      </AppLinkButton>
                    </ActionRow>

                    <Text c="var(--app-text-muted)" fz="sm">
                      복원하면 다시 작품 목록으로 돌아가며 현재 기록 상태도 그대로 유지됩니다.
                    </Text>
                  </Stack>
                </Group>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </section>
  );
}
