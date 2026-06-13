import { Stack, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { getWorkTypeLabel } from '../utils/work-options';

interface DuplicateWorkCandidatesCardProps {
  candidates: WorkRecord[];
}

export function DuplicateWorkCandidatesCard({
  candidates,
}: DuplicateWorkCandidatesCardProps) {
  const { t } = useAppTranslation();

  if (candidates.length === 0) {
    return null;
  }

  return (
    <SectionCard gap="sm" padding="md" tone="subtle">
      <Stack gap="xs">
        <AppBadge tone="warning">{t('works.add.duplicate.title')}</AppBadge>
        <Text c="dimmed" size="sm">
          {t('works.add.duplicate.description')}
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
                {t('works.add.duplicate.action')}
              </AppLinkButton>
            </ActionRow>
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
