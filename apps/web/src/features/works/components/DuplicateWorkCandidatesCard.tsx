import { Stack, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import { getWorkTypeLabel } from '../utils/work-options';

interface DuplicateWorkCandidatesCardProps {
  candidates: WorkRecord[];
}

export function DuplicateWorkCandidatesCard({
  candidates,
}: DuplicateWorkCandidatesCardProps) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <SectionCard gap="sm" padding="md" tone="subtle">
      <Stack gap="xs">
        <AppBadge tone="warning">비슷한 기록이 있습니다</AppBadge>
        <Text c="dimmed" size="sm">
          같은 작품을 다시 만들기 전에 기존 기록을 확인할 수 있습니다. 저장은
          계속 진행할 수 있습니다.
        </Text>
        <Stack gap="xs">
          {candidates.map((candidate) => (
            <ActionRow justify="space-between" key={candidate.id}>
              <div>
                <Text fw={700}>{candidate.title}</Text>
                <Text c="dimmed" size="xs">
                  {getWorkTypeLabel(candidate.type)}
                  {candidate.author ? ` · ${candidate.author}` : ''}
                </Text>
              </div>
              <AppLinkButton
                size="compact-sm"
                to={`/works/${candidate.id}`}
                tone="secondary"
              >
                기존 작품 보기
              </AppLinkButton>
            </ActionRow>
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
