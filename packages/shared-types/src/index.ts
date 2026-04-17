export type ISODateString = string;

export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type EntityId = string;

export const WORK_TYPES = [
  'novel',
  'anime',
  'manga',
  'light_novel',
  'web_novel',
  'webtoon',
  'movie',
  'drama',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'paused',
  'dropped',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export type WorkTier = (typeof WORK_TIERS)[number];

export const WORK_SYNC_STATUSES = [
  'local-only',
  'pending',
  'synced',
  'conflict',
] as const;

export type WorkSyncStatus = (typeof WORK_SYNC_STATUSES)[number];

export interface WorkRecord extends AuditFields {
  id: EntityId;
  type: WorkType;
  title: string;
  author: string;
  genres: string[];
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  tier: WorkTier | null;
  favorite: boolean;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}
