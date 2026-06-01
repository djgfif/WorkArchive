import type {
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardCardSourceType,
  TierBoardType,
  TierBoardVisibility,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

export interface CreateBoardInput {
  boardType?: TierBoardType;
  description?: string;
  templateTitle?: string;
  title?: string;
}

export interface UpdateBoardInput {
  boardType?: TierBoardType;
  coverImageUrl?: string;
  description?: string;
  title?: string;
  visibility?: TierBoardVisibility;
}

export interface CreateLaneInput {
  colorToken?: string;
  description?: string;
  title: string;
}

export interface UpdateLaneInput {
  colorToken?: string;
  description?: string;
  title?: string;
}

export interface CreateCardInput {
  imageUrl?: string;
  laneId?: string | null;
  note?: string;
  cardSourceType?: TierBoardCardSourceType;
  subtitle?: string;
  title: string;
}

export interface UpdateCardInput {
  imageUrl?: string;
  note?: string;
  subtitle?: string;
  title?: string;
}

export interface ImportIdMaps {
  boardIds: Map<string, string>;
  laneIds: Map<string, string>;
  cardIds: Map<string, string>;
}

export type TierBoardExportAsset = TierBoardAssetRecord & {
  dataUrl?: string;
};

export interface TierBoardExportDocument {
  assets: TierBoardExportAsset[];
  board: TierBoardRecord;
  exportedAt: string;
  format: 'work-archive.tier-board';
  cards: TierBoardCardRecord[];
  lanes: TierLaneRecord[];
  version: 1;
}

export interface TierLaneDeleteSnapshot {
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
}

export type TierBoardChangeSource =
  | 'tier_board_create'
  | 'tier_board_update'
  | 'tier_board_import'
  | 'tier_board_migration';

export type TierBoardAssetChangeSource =
  | 'tier_board_asset_update'
  | 'tier_board_create'
  | 'tier_board_migration'
  | 'tier_board_import';
