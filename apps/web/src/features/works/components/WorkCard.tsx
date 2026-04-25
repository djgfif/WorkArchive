import { Box, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
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
    <SectionCard gap="sm" padding="sm">
      <Box pos="relative" w="100%">
        <Box maw={128}>
          <ArtworkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="card"
          />
        </Box>
        <Box
          pos="absolute"
          style={{
            left: '0.45rem',
            top: '0.45rem',
          }}
        >
          <AppBadge tone="accent">{statusLabel}</AppBadge>
        </Box>
      </Box>

      <Stack gap="sm">
        <ActionRow>
          <AppBadge>{ratingLabel}</AppBadge>
          <AppBadge>{typeLabel}</AppBadge>
          {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
        </ActionRow>

        <div>
          <Title order={3} lineClamp={2} size="h4">
            <Link style={{ color: 'inherit', textDecoration: 'none' }} to={`/works/${work.id}`}>
              {work.title}
            </Link>
          </Title>
          <Text c="var(--app-text-muted)" size="sm">
            {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
          </Text>
        </div>

        <Text c="var(--app-text-secondary)" lineClamp={2} size="sm">
          {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
        </Text>

        <ActionRow>
          {visibleGenres.length > 0 ? (
            visibleGenres.map((genre) => <AppBadge key={genre}>{genre}</AppBadge>)
          ) : (
            <AppBadge tone="muted">장르 없음</AppBadge>
          )}
          {work.genres.length > visibleGenres.length && (
            <AppBadge>+{work.genres.length - visibleGenres.length}</AppBadge>
          )}
        </ActionRow>

        <ActionRow justify="space-between">
          <AppLinkButton size="compact-sm" to={`/works/${work.id}`} tone="quiet">
            상세
          </AppLinkButton>
          <AppLinkButton size="compact-sm" to={`/works/${work.id}/edit`} tone="ghost">
            수정
          </AppLinkButton>
          <AppButton
            aria-label={`${work.title} 삭제`}
            onClick={() => void onDelete(work)}
            size="compact-sm"
            tone="danger"
            type="button"
          >
            삭제
          </AppButton>
        </ActionRow>
      </Stack>
    </SectionCard>
  );
}
