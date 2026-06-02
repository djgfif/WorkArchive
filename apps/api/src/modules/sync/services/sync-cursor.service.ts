import { BadRequestException, Injectable } from '@nestjs/common';

import type { PullSyncChangeDto } from '../dto/pull-sync-response.dto';
import {
  DEFAULT_PULL_PAGE_LIMIT,
  MAX_PULL_CURSOR_LENGTH,
  MAX_PULL_PAGE_LIMIT,
  type PullCursor,
} from '../sync-internal.types';
import { SYNC_ENTITY_TYPES, type SyncEntityType } from '../sync.constants';

const PULL_CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SyncCursorService {
  encodePullCursor(cursor: PullCursor) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  parsePullCursor(value: string | null): PullCursor | null {
    if (!value) {
      return null;
    }

    if (
      value.length > MAX_PULL_CURSOR_LENGTH ||
      !PULL_CURSOR_PATTERN.test(value)
    ) {
      throw new BadRequestException('cursor must be a valid sync pull cursor.');
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as Partial<PullCursor>;

      if (
        !decoded ||
        typeof decoded.updatedAt !== 'string' ||
        typeof decoded.entityType !== 'string' ||
        typeof decoded.entityId !== 'string' ||
        !SYNC_ENTITY_TYPES.includes(decoded.entityType as SyncEntityType) ||
        !UUID_PATTERN.test(decoded.entityId) ||
        Number.isNaN(Date.parse(decoded.updatedAt))
      ) {
        throw new Error('Invalid cursor shape.');
      }

      return {
        entityId: decoded.entityId,
        entityType: decoded.entityType as SyncEntityType,
        updatedAt: decoded.updatedAt,
      };
    } catch {
      throw new BadRequestException('cursor must be a valid sync pull cursor.');
    }
  }

  resolvePullLimit(limit: number | undefined) {
    if (limit === undefined) {
      return DEFAULT_PULL_PAGE_LIMIT;
    }

    return Math.min(Math.max(limit, 1), MAX_PULL_PAGE_LIMIT);
  }

  isAfterCursor(
    cursor: PullCursor | null,
    entityType: SyncEntityType,
    entityId: string,
    updatedAt: Date,
  ) {
    if (!cursor) {
      return true;
    }

    const updatedAtIso = updatedAt.toISOString();

    return (
      updatedAtIso > cursor.updatedAt ||
      (updatedAtIso === cursor.updatedAt &&
        (entityType > cursor.entityType ||
          (entityType === cursor.entityType && entityId > cursor.entityId)))
    );
  }

  findPullPageCursorFilter(
    entityType: SyncEntityType,
    since: Date | null,
    cursor: PullCursor | null,
  ) {
    const filters: Array<Record<string, unknown>> = [];

    if (since) {
      filters.push({
        updatedAt: {
          gt: since,
        },
      });
    }

    if (cursor) {
      const cursorUpdatedAt = this.parseIsoDate(
        cursor.updatedAt,
        'cursor.updatedAt',
      );
      const entityTypeDelta = entityType.localeCompare(cursor.entityType);

      if (entityTypeDelta < 0) {
        filters.push({
          updatedAt: {
            gt: cursorUpdatedAt,
          },
        });
      } else if (entityTypeDelta === 0) {
        filters.push({
          OR: [
            {
              updatedAt: {
                gt: cursorUpdatedAt,
              },
            },
            {
              id: {
                gt: cursor.entityId,
              },
              updatedAt: {
                equals: cursorUpdatedAt,
              },
            },
          ],
        });
      } else {
        filters.push({
          OR: [
            {
              updatedAt: {
                gt: cursorUpdatedAt,
              },
            },
            {
              updatedAt: {
                equals: cursorUpdatedAt,
              },
            },
          ],
        });
      }
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  buildNextSince(
    previousSince: string | null,
    pulledAt: string,
    changedRecords: Array<{ updatedAt: Date }>,
  ) {
    if (changedRecords.length === 0) {
      return previousSince ?? pulledAt;
    }

    return changedRecords.at(-1)?.updatedAt.toISOString() ?? pulledAt;
  }

  getPullChangeUpdatedAt(change: PullSyncChangeDto) {
    return (
      change.work?.updatedAt ??
      change.releaseRecord?.updatedAt ??
      change.timelineEntry?.updatedAt ??
      change.series?.updatedAt ??
      change.contributor?.updatedAt ??
      change.workSeriesLink?.updatedAt ??
      change.workContributor?.updatedAt ??
      change.workRelation?.updatedAt ??
      change.tierBoard?.updatedAt ??
      change.tierLane?.updatedAt ??
      change.tierBoardCard?.updatedAt ??
      change.tierBoardAsset?.updatedAt ??
      null
    );
  }

  private parseIsoDate(value: string, _fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('cursor must be a valid sync pull cursor.');
    }

    return parsed;
  }
}
