import {
  Box,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { FormEvent } from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import type { NotionChangePreview } from '../../services/notion.service';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import styles from './SettingsControlCenter.module.css';

const css = styles;

interface NotionSyncSettingsSectionProps {
  connectionDraft: {
    dataSourceId: string;
    token: string;
  };
  feedback: SettingsFeedback | null;
  isApplyingPull: boolean;
  isDeletingConnection: boolean;
  isLoadingStatus: boolean;
  isPreviewingPull: boolean;
  isPushing: boolean;
  isSavingConnection: boolean;
  isTestingConnection: boolean;
  mode: 'authenticated' | 'guest';
  onApplyPull: () => void;
  onDeleteConnection: () => void;
  onPreviewPull: () => void;
  onPushToNotion: () => void;
  onSaveConnection: () => void;
  onTestConnection: () => void;
  onUpdateConnectionDraft: (
    field: 'dataSourceId' | 'token',
    value: string,
  ) => void;
  pullPreview: {
    changes: NotionChangePreview[];
    total: number;
  } | null;
  status: {
    configured: boolean;
    dataSourceId: string | null;
    lastSyncedAt: string | null;
    mappedCount: number;
  } | null;
}

const fieldLabels: Record<string, string> = {
  completedAt: '완료일',
  droppedAt: '중단일',
  favorite: '즐겨찾기',
  personalTags: '개인 태그',
  progressCurrent: '현재 진행도',
  progressTotal: '전체 진행도',
  progressUnit: '진행 단위',
  rating: '별점',
  review: '긴 리뷰',
  shortReview: '짧은 리뷰',
  startedAt: '시작일',
  status: '감상 상태',
};

function formatValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '비어 있음';
  }

  if (typeof value === 'boolean') {
    return value ? '예' : '아니오';
  }

  if (value === null || value === undefined || value === '') {
    return '비어 있음';
  }

  return String(value);
}

function PreviewChangeCard({ change }: { change: NotionChangePreview }) {
  return (
    <Box className={css.providerInfoCard ?? ''}>
      <Stack gap="xs">
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Text className={css.providerInfoTitle ?? ''}>{change.title}</Text>
          <AppBadge tone="info">{change.changes.length}개 변경</AppBadge>
        </Group>
        <Stack gap={4}>
          {change.changes.slice(0, 4).map((entry) => (
            <Text className={css.providerInfoMeta ?? ''} key={entry.field}>
              {fieldLabels[entry.field] ?? entry.field}: 로컬{' '}
              {formatValue(entry.localValue)} → Notion{' '}
              {formatValue(entry.notionValue)}
            </Text>
          ))}
          {change.changes.length > 4 && (
            <Text className={css.providerInfoMeta ?? ''}>
              외 {change.changes.length - 4}개 필드
            </Text>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export function NotionSyncSettingsSection({
  connectionDraft,
  feedback,
  isApplyingPull,
  isDeletingConnection,
  isLoadingStatus,
  isPreviewingPull,
  isPushing,
  isSavingConnection,
  isTestingConnection,
  mode,
  onApplyPull,
  onDeleteConnection,
  onPreviewPull,
  onPushToNotion,
  onSaveConnection,
  onTestConnection,
  onUpdateConnectionDraft,
  pullPreview,
  status,
}: NotionSyncSettingsSectionProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveConnection();
  }

  const configured = Boolean(status?.configured);

  return (
    <SectionCard>
      <SectionIntro
        description="Work Archive를 원장으로 유지하면서 Notion 데이터소스를 외부 편집/백업 미러로 사용합니다. Notion에서 바꾼 안전 필드는 미리보기 후 적용합니다."
        eyebrow="Notion 동기화"
        title="Notion 편집 미러"
      />

      {mode !== 'authenticated' ? (
        <Text c="dimmed">
          Notion 연결은 로그인한 계정의 서버 보안 저장소에서만 관리됩니다.
        </Text>
      ) : isLoadingStatus ? (
        <Text aria-busy="true" c="dimmed">
          Notion 연결 상태를 불러오는 중입니다.
        </Text>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  연결 상태
                </Text>
                <Group gap="xs">
                  <Text fw={900}>{configured ? '연결됨' : '미연결'}</Text>
                  <AppBadge tone={configured ? 'success' : 'warning'}>
                    Notion
                  </AppBadge>
                </Group>
              </Stack>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  매핑된 작품
                </Text>
                <Text fw={900}>{status?.mappedCount ?? 0}</Text>
              </Stack>
            </SectionCard>
            <SectionCard padding="md" tone="subtle">
              <Stack gap={4}>
                <Text c="dimmed" fw={760} size="xs">
                  마지막 동기화
                </Text>
                <Text fw={900} size="sm">
                  {status?.lastSyncedAt
                    ? new Date(status.lastSyncedAt).toLocaleString()
                    : '기록 없음'}
                </Text>
              </Stack>
            </SectionCard>
          </SimpleGrid>

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                data-1p-ignore="true"
                data-lpignore="true"
                description="Notion 데이터베이스의 Manage data sources 메뉴에서 복사한 data source ID를 입력합니다."
                label="Notion data source ID"
                onChange={(event) =>
                  onUpdateConnectionDraft(
                    'dataSourceId',
                    event.currentTarget.value,
                  )
                }
                placeholder="예: 1a44be1209534631b4989e5817518db8"
                spellCheck={false}
                value={connectionDraft.dataSourceId}
              />
              <PasswordInput
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                description="저장 후에는 값이 다시 표시되지 않습니다. Notion integration을 데이터소스에 공유해야 합니다."
                label="Notion token"
                onChange={(event) =>
                  onUpdateConnectionDraft('token', event.currentTarget.value)
                }
                placeholder="secret_..."
                value={connectionDraft.token}
              />
              <ActionRow>
                <AppButton
                  disabled={isDeletingConnection}
                  loading={isSavingConnection}
                  tone="primary"
                  type="submit"
                >
                  Notion 연결 저장
                </AppButton>
                <AppButton
                  disabled={!configured || isSavingConnection}
                  loading={isTestingConnection}
                  onClick={() => void onTestConnection()}
                  tone="secondary"
                  type="button"
                >
                  연결 테스트
                </AppButton>
                <AppButton
                  disabled={!configured || isSavingConnection}
                  loading={isDeletingConnection}
                  onClick={() => void onDeleteConnection()}
                  tone="danger"
                  type="button"
                >
                  연결 삭제
                </AppButton>
              </ActionRow>
            </Stack>
          </form>

          <Divider />

          <SectionCard padding="md" tone="subtle">
            <Stack gap="md">
              <SectionIntro
                description="빠른 내부 동기화와 분리해 수동으로 실행합니다. Notion rate limit을 피하기 위해 대량 변경은 천천히 처리됩니다."
                eyebrow="수동 동기화"
                title="Push / Pull"
                titleOrder={3}
              />
              <ActionRow>
                <AppButton
                  disabled={!configured || isPreviewingPull || isApplyingPull}
                  loading={isPushing}
                  onClick={() => void onPushToNotion()}
                  tone="primary"
                  type="button"
                >
                  Work Archive → Notion
                </AppButton>
                <AppButton
                  disabled={!configured || isPushing || isApplyingPull}
                  loading={isPreviewingPull}
                  onClick={() => void onPreviewPull()}
                  tone="secondary"
                  type="button"
                >
                  Notion 변경 미리보기
                </AppButton>
                <AppButton
                  disabled={!pullPreview || pullPreview.total === 0 || isPushing}
                  loading={isApplyingPull}
                  onClick={() => void onApplyPull()}
                  tone="secondary"
                  type="button"
                >
                  미리보기 적용
                </AppButton>
              </ActionRow>
            </Stack>
          </SectionCard>

          {pullPreview && pullPreview.changes.length > 0 && (
            <Stack gap="sm">
              <Group gap="xs" justify="space-between">
                <Text fw={850}>Notion 변경 미리보기</Text>
                <AppBadge tone="info">{pullPreview.total}건</AppBadge>
              </Group>
              <div className={css.publicProviderGrid ?? ''}>
                {pullPreview.changes.slice(0, 6).map((change) => (
                  <PreviewChangeCard change={change} key={change.workId} />
                ))}
              </div>
            </Stack>
          )}

          {feedback && (
            <FeedbackMessage tone={feedback.tone}>
              {feedback.message}
            </FeedbackMessage>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}
