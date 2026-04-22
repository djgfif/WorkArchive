import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppButton,
  AppLinkButton,
  SectionCard,
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
    <section className="works-section">
      <Stack gap="md">
        {works.map((work) => {
          const isRestoring = restoringWorkId === work.id;
          const typeLabel = getWorkTypeLabel(work.type);

          return (
            <SectionCard key={work.id} tone={isRestoring ? 'hero' : 'default'}>
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <Group align="flex-start" wrap="nowrap">
                  <ArtworkPoster
                    thumbnailUrl={work.thumbnailUrl}
                    title={work.title}
                    typeLabel={typeLabel}
                    variant="row"
                  />

                  <Stack gap="sm" miw={0}>
                    <Group gap="xs" wrap="wrap">
                      <Badge>{typeLabel}</Badge>
                      <Badge>{getWorkStatusLabel(work.status)}</Badge>
                      <Badge>{getWorkSyncStatusLabel(work.syncStatus)}</Badge>
                      {isRestoring && <Badge color="blue">복원 중</Badge>}
                    </Group>

                    <Stack gap={4}>
                      <Title order={3}>{work.title}</Title>
                      <Text c="var(--app-text-muted)">
                        {work.author || '작가·제작자 미입력'} · 삭제한 날{' '}
                        {formatWorkDateTime(work.deletedAt ?? work.updatedAt)}
                      </Text>
                    </Stack>

                    <Text c="var(--app-text-secondary)">
                      {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
                    </Text>
                  </Stack>
                </Group>

                <ActionRow justify="flex-end">
                  <AppButton
                    disabled={isRestoring}
                    onClick={() => void onRestore(work)}
                    tone="primary"
                    type="button"
                  >
                    {isRestoring ? '복원 중...' : '복원'}
                  </AppButton>
                  <AppLinkButton to={`/works?q=${encodeURIComponent(work.title)}`}>
                    비슷한 기록 보기
                  </AppLinkButton>
                </ActionRow>
              </Group>

              <Text c="var(--app-text-muted)" fz="sm">
                복원하면 다시 작품 목록에 나타나고, 현재 기록 상태도 그대로 유지됩니다.
              </Text>
            </SectionCard>
          );
        })}
      </Stack>
    </section>
  );
}
