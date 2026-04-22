import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppButton,
  AppLinkButton,
  KeyValueGrid,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkCardProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  work: WorkRecord;
}

export function WorkCard({ onDelete, work }: WorkCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const visibleGenres = work.genres.slice(0, 3);
  const ratingLabel = work.rating === null ? '미평가' : `${work.rating.toFixed(1)}점`;

  return (
    <SectionCard>
      <Group align="flex-start" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="card"
        />

        <Stack flex={1} gap="md" miw={0}>
          <Group gap="xs" wrap="wrap">
            <Badge>{statusLabel}</Badge>
            <Badge>{ratingLabel}</Badge>
            <Badge>{typeLabel}</Badge>
            {work.favorite && <Badge color="archive">즐겨찾기</Badge>}
          </Group>

          <Stack gap={4}>
            <Title order={3}>
              <Link style={{ color: 'inherit', textDecoration: 'none' }} to={`/works/${work.id}`}>
                {work.title}
              </Link>
            </Title>
            <Text c="var(--app-text-muted)">
              {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
            </Text>
          </Stack>

          <Text c="var(--app-text-secondary)">
            {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
          </Text>

          <KeyValueGrid
            columns={3}
            items={[
              { label: '타입', value: typeLabel },
              { label: '상태', value: statusLabel },
              {
                label: '장르',
                value: visibleGenres.length > 0 ? visibleGenres.join(', ') : '장르 없음',
              },
            ]}
          />

          <ActionRow justify="space-between">
            <Group gap="xs" wrap="wrap">
              {visibleGenres.length > 0 ? (
                visibleGenres.map((genre) => <Badge key={genre}>{genre}</Badge>)
              ) : (
                <Badge variant="outline">장르 없음</Badge>
              )}
              {work.genres.length > visibleGenres.length && (
                <Badge>+{work.genres.length - visibleGenres.length}</Badge>
              )}
            </Group>

            <ActionRow justify="flex-end">
              <AppLinkButton to={`/works/${work.id}`}>상세</AppLinkButton>
              <AppLinkButton to={`/works/${work.id}/edit`}>수정</AppLinkButton>
              <AppButton
                aria-label={`${work.title} 삭제`}
                onClick={() => void onDelete(work)}
                tone="danger"
                type="button"
              >
                삭제
              </AppButton>
            </ActionRow>
          </ActionRow>

          <Text c="var(--app-text-muted)" fz="sm">
            삭제하면 현재 목록에서 숨겨집니다.
          </Text>
        </Stack>
      </Group>
    </SectionCard>
  );
}
