import type { CreateLaneInput } from './tier-board.types';

export const DEFAULT_TIER_BOARD_LANES = [
  { title: 'S', colorToken: '#ef4444' },
  { title: 'A', colorToken: '#f97316' },
  { title: 'B', colorToken: '#22c55e' },
  { title: 'C', colorToken: '#38bdf8' },
  { title: 'D', colorToken: '#94a3b8' },
] as const satisfies readonly CreateLaneInput[];

export interface TierBoardTemplate {
  title: string;
  lanes: readonly CreateLaneInput[];
}

export const TIER_BOARD_TEMPLATES = [
  {
    title: 'S/A/B/C/D',
    lanes: DEFAULT_TIER_BOARD_LANES,
  },
  {
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
    title: '최애/좋음/무난/아쉬움',
    lanes: [
      { title: '최애', colorToken: '#ec4899' },
      { title: '좋음', colorToken: '#22c55e' },
      { title: '무난', colorToken: '#38bdf8' },
      { title: '아쉬움', colorToken: '#94a3b8' },
    ],
  },
  {
    title: '최강/상위/중위/하위',
    lanes: [
      { title: '최강', colorToken: '#a855f7' },
      { title: '상위', colorToken: '#f97316' },
      { title: '중위', colorToken: '#22c55e' },
      { title: '하위', colorToken: '#64748b' },
    ],
  },
  {
    title: '빈 보드',
    lanes: [],
  },
] as const satisfies readonly TierBoardTemplate[];

export function getTierBoardTemplate(templateTitle?: string) {
  return (
    TIER_BOARD_TEMPLATES.find(
      (candidate) => candidate.title === templateTitle,
    ) ?? TIER_BOARD_TEMPLATES[0]!
  );
}
