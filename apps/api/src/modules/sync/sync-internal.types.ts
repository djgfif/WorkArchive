import type { PullSyncChangeDto } from './dto/pull-sync-response.dto';
import type {
  SyncEntityType,
} from './sync.constants';

export const DEFAULT_PULL_PAGE_LIMIT = 500;
export const MAX_PULL_PAGE_LIMIT = 1000;

export interface PullCursor {
  entityId: string;
  entityType: SyncEntityType;
  updatedAt: string;
}

export interface OrderedPullChange {
  change: PullSyncChangeDto;
  cursor: PullCursor;
  updatedAtMs: number;
}
