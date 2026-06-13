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
import { useAppTranslation, type AppTranslationKey } from '@app/i18n';
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
  const { t } = useAppTranslation();

  return (
    <Modal onClose={onClose} opened={opened} title={t('tierBoards.settings.title')}>
      <Stack gap="md">
        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Stack gap={2}>
              <Text fw={800}>{t('tierBoards.settings.boardInfoTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('tierBoards.settings.boardInfoDescription')}
              </Text>
            </Stack>
            <TextInput
              label={t('tierBoards.settings.boardTitleLabel')}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setSettingsDraft((draft) => ({ ...draft, title: value }));
              }}
              value={settingsDraft.title}
            />
            <Textarea
              autosize
              label={t('tierBoards.settings.boardDescriptionLabel')}
              minRows={2}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setSettingsDraft((draft) => ({
                  ...draft,
                  description: value,
                }));
              }}
              placeholder={t('tierBoards.settings.boardDescriptionPlaceholder')}
              value={settingsDraft.description}
            />
            <Select
              data={[
                { label: t('tierBoards.boardType.classic_tier'), value: 'classic_tier' },
                { label: t('tierBoards.boardType.ranking'), value: 'ranking' },
                { label: t('tierBoards.boardType.freeform'), value: 'freeform' },
              ]}
              label={t('tierBoards.settings.boardModeLabel')}
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
                { label: t('tierBoards.visibility.private'), value: 'private' },
                { label: t('tierBoards.visibility.link_only'), value: 'link_only' },
                { label: t('tierBoards.visibility.exported'), value: 'exported' },
              ]}
              label={t('tierBoards.settings.visibilityLabel')}
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
              <Text fw={800}>{t('tierBoards.settings.lanesTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('tierBoards.settings.lanesDescription')}
              </Text>
            </Stack>
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text fw={700} size="sm">
                  {t('tierBoards.settings.newLaneTitle')}
                </Text>
                <Text c="dimmed" size="sm">
                  {t('tierBoards.settings.newLaneDescription')}
                </Text>
              </Stack>
              <AppButton onClick={onCreateLane} tone="secondary" type="button">
                {t('tierBoards.addLane')}
              </AppButton>
            </Group>
            <Select
              data={TIER_BOARD_TEMPLATES.map((template) => ({
                label: getTemplateLabel(template, t),
                value: getTemplateValue(template),
              }))}
              description={t('tierBoards.settings.templateDescription')}
              label={t('tierBoards.settings.templateLabel')}
              onChange={(value) => value && onApplyLaneTemplate(value)}
              placeholder={t('tierBoards.settings.templatePlaceholder')}
            />
          </Stack>
        </Paper>

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            {t('tierBoards.settings.editLaneHint')}
          </Text>
          <Group gap="xs">
            <AppButton onClick={onClose} tone="quiet" type="button">
              {t('common.cancel')}
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              {t('common.save')}
            </AppButton>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function getTemplateValue(template: { id?: string; title: string }) {
  return template.id ?? template.title;
}

function getTemplateLabel(
  template: { title: string; titleKey?: AppTranslationKey },
  t: (key: AppTranslationKey) => string,
) {
  return getTemplateText(template.titleKey ?? template.title, t);
}

function getTemplateText(value: string, t: (key: AppTranslationKey) => string) {
  return value.startsWith('tierBoards.templates.')
    ? t(value as AppTranslationKey)
    : value;
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
  const { t } = useAppTranslation();

  return (
    <Modal
      onClose={onClose}
      opened={laneEditor !== null}
      title={t('tierBoards.laneEditor.title')}
    >
      {laneEditor && (
        <Stack gap="md">
          <TextInput
            label={t('tierBoards.laneEditor.label')}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, title: value });
            }}
            value={laneEditor.title}
          />
          <Stack gap="xs">
            <Text fw={700} size="sm">
              {t('tierBoards.laneEditor.presetColor')}
            </Text>
            <Group gap="xs">
              {LANE_COLORS.map((color) => (
                <button
                  aria-label={t('tierBoards.laneEditor.colorAria', { color })}
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
            label={t('tierBoards.laneEditor.hexColor')}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, colorToken: value });
            }}
            value={laneEditor.colorToken}
          />
          <Textarea
            autosize
            label={t('tierBoards.descriptionLabel')}
            minRows={2}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setLaneEditor({ ...laneEditor, description: value });
            }}
            value={laneEditor.description}
          />
          <Group justify="flex-end">
            <AppButton onClick={onClose} tone="quiet" type="button">
              {t('common.cancel')}
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              {t('common.save')}
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
  const { t } = useAppTranslation();

  return (
    <Modal
      onClose={onClose}
      opened={cardEditor !== null}
      title={t('tierBoards.cardEditor.title')}
    >
      {cardEditor && (
        <Stack gap="md">
          <TextInput
            label={t('tierBoards.titleLabel')}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, title: value });
            }}
            value={cardEditor.title}
          />
          <TextInput
            label={t('tierBoards.cardEditor.subtitle')}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, subtitle: value });
            }}
            value={cardEditor.subtitle}
          />
          <TextInput
            label={t('tierBoards.cardEditor.imageUrl')}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, imageUrl: value });
            }}
            value={cardEditor.imageUrl}
          />
          <Textarea
            autosize
            label={t('tierBoards.cardEditor.note')}
            minRows={2}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardEditor({ ...cardEditor, note: value });
            }}
            value={cardEditor.note}
          />
          <Group justify="flex-end">
            <AppButton onClick={onClose} tone="quiet" type="button">
              {t('common.cancel')}
            </AppButton>
            <AppButton onClick={onSave} tone="primary" type="button">
              {t('common.save')}
            </AppButton>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
