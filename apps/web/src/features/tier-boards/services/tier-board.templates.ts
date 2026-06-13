import type { AppTranslationKey } from '@app/i18n';
import type { CreateLaneInput } from './tier-board.types';

export const DEFAULT_TIER_BOARD_LANES = [
  { title: 'S', colorToken: '#ef4444' },
  { title: 'A', colorToken: '#f97316' },
  { title: 'B', colorToken: '#22c55e' },
  { title: 'C', colorToken: '#38bdf8' },
  { title: 'D', colorToken: '#94a3b8' },
] as const satisfies readonly CreateLaneInput[];

export interface TierBoardTemplate {
  id?: string;
  titleKey?: AppTranslationKey;
  title: string;
  lanes: readonly CreateLaneInput[];
}

export const TIER_BOARD_TEMPLATES = [
  {
    id: 'standard',
    titleKey: 'tierBoards.templates.standard.title',
    title: 'S/A/B/C/D',
    lanes: DEFAULT_TIER_BOARD_LANES,
  },
  {
    id: 'expanded',
    titleKey: 'tierBoards.templates.expanded.title',
    title: 'SS/S/A/B/C/D/F',
    lanes: [
      { title: 'SS', colorToken: '#f43f5e' },
      { title: 'S', colorToken: '#ef4444' },
      { title: 'A', colorToken: '#f97316' },
      { title: 'B', colorToken: '#22c55e' },
      { title: 'C', colorToken: '#38bdf8' },
      { title: 'D', colorToken: '#94a3b8' },
      { title: 'F', colorToken: '#64748b' },
    ],
  },
  {
    id: 'preference',
    titleKey: 'tierBoards.templates.preference.title',
    title: 'preference',
    lanes: [
      {
        title: 'tierBoards.templates.preference.lanes.favorite',
        colorToken: '#ec4899',
      },
      {
        title: 'tierBoards.templates.preference.lanes.good',
        colorToken: '#22c55e',
      },
      {
        title: 'tierBoards.templates.preference.lanes.neutral',
        colorToken: '#38bdf8',
      },
      {
        title: 'tierBoards.templates.preference.lanes.low',
        colorToken: '#94a3b8',
      },
    ],
  },
  {
    id: 'power',
    titleKey: 'tierBoards.templates.power.title',
    title: 'power',
    lanes: [
      { title: 'tierBoards.templates.power.lanes.top', colorToken: '#a855f7' },
      {
        title: 'tierBoards.templates.power.lanes.high',
        colorToken: '#f97316',
      },
      {
        title: 'tierBoards.templates.power.lanes.middle',
        colorToken: '#22c55e',
      },
      { title: 'tierBoards.templates.power.lanes.low', colorToken: '#64748b' },
    ],
  },
  {
    id: 'empty',
    titleKey: 'tierBoards.templates.empty.title',
    title: 'empty',
    lanes: [],
  },
] as const satisfies readonly TierBoardTemplate[];

export function getTierBoardTemplate(templateTitle?: string) {
  return (
    TIER_BOARD_TEMPLATES.find(
      (candidate) =>
        candidate.id === templateTitle ||
        candidate.title === templateTitle ||
        candidate.titleKey === templateTitle,
    ) ?? TIER_BOARD_TEMPLATES[0]!
  );
}
