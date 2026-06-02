import type { Dispatch, SetStateAction } from 'react';
import {
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';

import type {
  TierBoardCardRecord,
  TierBoardType,
  TierBoardVisibility,
  TierLaneRecord,
} from '@work-archive/shared-types';
import { AppButton } from '@shared/components/AppPrimitives';
import { TIER_BOARD_TEMPLATES } from '../services/tier-board.service';
import { LANE_COLORS } from '../utils/tier-board-editor-helpers';
import styles from '../pages/TierBoardsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

export interface TierBoardSettingsDraft {
  boardType: TierBoardType;
  description: string;
  title: string;
  visibility: TierBoardVisibility;
}

export function TierBoardSettingsModal({
  onApplyLaneTemplate,
  onClose,
  onCreateLane,
  onSave,
  opened,
  setSettingsDraft,
  settingsDraft,
}: {
  onApplyLaneTemplate: (templateTitle: string) => void;
  onClose: () => void;
  onCreateLane: () => void;
  onSave: () => void;
  opened: boolean;
  setSettingsDraft: Dispatch<SetStateAction<TierBoardSettingsDraft>>;
  settingsDraft: TierBoardSettingsDraft;
}) {
  return (
    <Modal onClose={onClose} opened={opened} title="보드 설정">
      <Stack gap="md">
        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Stack gap={2}>
              <Text fw={800}>보드 정보</Text>
              <Text c="dimmed" size="sm">
                제목, 설명, 보드 표시 방식을 정합니다.
              </Text>
            </Stack>
            <TextInput
              label="보드 제목"
              onChange={(event) => {
                const { value } = event.currentTarget;
                setSettingsDraft((draft) => ({ ...draft, title: value }));
              }}
              value={settingsDraft.title}
            />
            <Textarea
              autosize
              label="보드 설명"
              minRows={2}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setSettingsDraft((draft) => ({
                  ...draft,
                  description: value,
                }));
              }}
              placeholder="이 보드의 기준이나 용도를 적어두세요."
              value={settingsDraft.description}
            />
            <Select
              data={[
                { label: '티어형', value: 'classic_tier' },
                { label: '순위형', value: 'ranking' },
                { label: '자유 배치', value: 'freeform' },
              ]}
              label="보드 방식"
              onChange={(value) =>
                value &&
                setSettingsDraft((draft) => ({
                  ...draft,
                  boardType: value as TierBoardType,
                }))
              }
              value={settingsDraft.boardType}
            />
            <Select
              data={[
                { label: '개인용', value: 'private' },
                { label: '링크 공유', value: 'link_only' },
                { label: '내보냄', value: 'exported' },
              ]}
              label="공개 범위"
              onChange={(value) =>
                value &&
                setSettingsDraft((draft) => ({
                  ...draft,
                  visibility: value as TierBoardVisibility,
                }))
              }
              value={settingsDraft.visibility}
            />
          </Stack>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Stack gap={2}>
              <Text fw={800}>행 구성</Text>
              <Text c="dimmed" size="sm">
                S/A/B 같은 티어 행을 추가하거나 기본 행 템플릿으로 바꿉니다.
              </Text>
            </Stack>
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text fw={700} size="sm">
                  새 행 추가
                </Text>
                <Text c="dimmed" size="sm">
                  추가한 행은 보드에서 이름과 색상을 바로 수정할 수 있습니다.
                </Text>
              </Stack>
              <AppButton onClick={onCreateLane} tone="secondary" type="button">
                행 추가
              </AppButton>
            </Group>
            <Select
              data={TIER_BOARD_TEMPLATES.map((template) => ({
                label: template.title,
                value: template.title,
              }))}
              description="선택한 템플릿의 행 구성으로 보드를 다시 만듭니다."
              label="행 템플릿 적용"
              onChange={(value) => value && onApplyLaneTemplate(value)}
              placeholder="예: 기본 S/A/B/C/D"
            />
          </Stack>
        </Paper>

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            행 이름과 색상은 각 행의 ✎ 버튼에서 수정합니다.
          </Text>
          <Group gap="xs">
            <AppButton onClick={onClose} tone="quiet" type="button">
              취소
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              저장
            </AppButton>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TierBoardLaneEditorModal({
  laneEditor,
  onClose,
  onSave,
  setLaneEditor,
}: {
  laneEditor: TierLaneRecord | null;
  onClose: () => void;
  onSave: () => void;
  setLaneEditor: Dispatch<SetStateAction<TierLaneRecord | null>>;
}) {
  return (
    <Modal onClose={onClose} opened={laneEditor !== null} title="Lane 수정">
      {laneEditor && (
        <Stack gap="md">
          <TextInput
            label="Label"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, title: value });
            }}
            value={laneEditor.title}
          />
          <Stack gap="xs">
            <Text fw={700} size="sm">
              Preset color
            </Text>
            <Group gap="xs">
              {LANE_COLORS.map((color) => (
                <button
                  aria-label={`색상 ${color}`}
                  className={cn(css.colorChip)}
                  key={color}
                  onClick={() =>
                    setLaneEditor({ ...laneEditor, colorToken: color })
                  }
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </Group>
          </Stack>
          <TextInput
            label="Hex color"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, colorToken: value });
            }}
            value={laneEditor.colorToken}
          />
          <Textarea
            autosize
            label="Description"
            minRows={2}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, description: value });
            }}
            value={laneEditor.description}
          />
          <Group justify="flex-end">
            <AppButton onClick={onClose} tone="quiet" type="button">
              취소
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              저장
            </AppButton>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export function TierBoardCardEditorModal({
  cardEditor,
  onClose,
  onSave,
  setCardEditor,
}: {
  cardEditor: TierBoardCardRecord | null;
  onClose: () => void;
  onSave: () => void;
  setCardEditor: Dispatch<SetStateAction<TierBoardCardRecord | null>>;
}) {
  return (
    <Modal onClose={onClose} opened={cardEditor !== null} title="카드 수정">
      {cardEditor && (
        <Stack gap="md">
          <TextInput
            label="Title"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, title: value });
            }}
            value={cardEditor.title}
          />
          <TextInput
            label="Subtitle"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, subtitle: value });
            }}
            value={cardEditor.subtitle}
          />
          <TextInput
            label="Image URL"
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, imageUrl: value });
            }}
            value={cardEditor.imageUrl}
          />
          <Textarea
            autosize
            label="Note"
            minRows={2}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, note: value });
            }}
            value={cardEditor.note}
          />
          <Group justify="flex-end">
            <AppButton onClick={onClose} tone="quiet" type="button">
              취소
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              저장
            </AppButton>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
