import { Injectable } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';

import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import type { SyncEntityType } from '../sync.constants';

type SyncPayloadDto =
  | SyncWorkPayloadDto
  | SyncReleaseRecordPayloadDto
  | SyncTimelineEntryPayloadDto
  | SyncSeriesPayloadDto
  | SyncWorkSeriesLinkPayloadDto
  | SyncContributorPayloadDto
  | SyncWorkContributorPayloadDto
  | SyncWorkRelationPayloadDto
  | SyncTierBoardPayloadDto
  | SyncTierLanePayloadDto
  | SyncTierBoardCardPayloadDto
  | SyncTierBoardAssetPayloadDto;

const SYNC_PAYLOAD_DTO_BY_ENTITY_TYPE = {
  contributor: SyncContributorPayloadDto,
  release_record: SyncReleaseRecordPayloadDto,
  series: SyncSeriesPayloadDto,
  tier_board: SyncTierBoardPayloadDto,
  tier_board_asset: SyncTierBoardAssetPayloadDto,
  tier_board_card: SyncTierBoardCardPayloadDto,
  tier_lane: SyncTierLanePayloadDto,
  timeline_entry: SyncTimelineEntryPayloadDto,
  work: SyncWorkPayloadDto,
  work_contributor: SyncWorkContributorPayloadDto,
  work_relation: SyncWorkRelationPayloadDto,
  work_series_link: SyncWorkSeriesLinkPayloadDto,
} satisfies Record<SyncEntityType, ClassConstructor<SyncPayloadDto>>;

@Injectable()
export class SyncPayloadValidationService {
  validateChangePayload(
    change: PushSyncChangeDto,
  ):
    | { ok: true; payload: SyncPayloadDto }
    | { ok: false; result: PushSyncResultDto } {
    const dtoClass =
      SYNC_PAYLOAD_DTO_BY_ENTITY_TYPE[change.entityType as SyncEntityType];

    if (!dtoClass) {
      return {
        ok: false,
        result: this.buildPayloadValidationFailure(
          change,
          `Unsupported sync entityType "${String(change.entityType)}".`,
        ),
      };
    }

    if (!this.isObjectPayload(change.payload)) {
      return {
        ok: false,
        result: this.buildPayloadValidationFailure(
          change,
          'Invalid sync payload: payload must be an object.',
        ),
      };
    }

    const payload = plainToInstance(
      dtoClass as ClassConstructor<SyncPayloadDto>,
      change.payload,
    );
    const errors = validateSync(payload, {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      skipMissingProperties: false,
      validationError: {
        target: false,
        value: false,
      },
      whitelist: true,
    });

    if (errors.length > 0) {
      return {
        ok: false,
        result: this.buildPayloadValidationFailure(
          change,
          `Invalid ${change.entityType} sync payload: ${this.formatValidationErrors(errors)}.`,
        ),
      };
    }

    if (payload.id !== change.entityId) {
      return {
        ok: false,
        result: this.buildPayloadValidationFailure(
          change,
          'Invalid sync payload: payload.id must match entityId.',
        ),
      };
    }

    return {
      ok: true,
      payload,
    };
  }

  buildPayloadValidationFailure(
    change: PushSyncChangeDto,
    message: string,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'failed',
      code: 'failed_validation',
      message,
    };
  }

  private isObjectPayload(
    payload: unknown,
  ): payload is Record<string, unknown> {
    return (
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    );
  }

  private formatValidationErrors(errors: ValidationError[]) {
    const messages = this.flattenValidationErrors(errors);

    return messages.slice(0, 3).join('; ') || 'payload is invalid';
  }

  private flattenValidationErrors(
    errors: ValidationError[],
    parentPath = 'payload',
  ): string[] {
    return errors.flatMap((error) => {
      const path = `${parentPath}.${error.property}`;
      const ownMessages = Object.values(error.constraints ?? {}).map(
        (constraint) => `${path} ${constraint}`,
      );

      return [
        ...ownMessages,
        ...this.flattenValidationErrors(error.children ?? [], path),
      ];
    });
  }
}
