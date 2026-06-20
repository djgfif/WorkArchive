import type { CatalogService } from '../../catalog/catalog.service';
import type { UserReleaseRecordsService } from '../../user-records/user-release-records.service';
import type { UserRecordsService } from '../../user-records/user-records.service';
import type { UserTimelineEntriesService } from '../../user-records/user-timeline-entries.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  applyContributorChange,
  applySeriesChange,
  applyWorkContributorChange,
  applyWorkRelationChange,
  applyWorkSeriesLinkChange,
} from './sync-push.graph-handler';
import { applyReleaseRecordChange } from './sync-push.release-record-handler';
import {
  applyTierBoardAssetChange,
  applyTierBoardCardChange,
  applyTierBoardChange,
  applyTierLaneChange,
} from './sync-push.tier-board-handler';
import { applyTimelineEntryChange } from './sync-push.timeline-entry-handler';
import { applyWorkChange } from './sync-push.work-handler';
import type { SyncPushClient } from './sync-push.client';
import type { SyncPayloadDto } from './sync-payload-validation.service';

export type SyncPushChangeDependencies = {
  catalogService: CatalogService;
  releaseRecordsService: UserReleaseRecordsService;
  timelineEntriesService: UserTimelineEntriesService;
  userRecordsService: UserRecordsService;
};

export function applyValidatedPushChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushChangeDependencies,
): Promise<PushSyncResultDto> {
  switch (change.entityType) {
    case 'series':
      return applySeriesChange(
        userId,
        change,
        payload as SyncSeriesPayloadDto,
        client,
      );
    case 'contributor':
      return applyContributorChange(
        userId,
        change,
        payload as SyncContributorPayloadDto,
        client,
      );
    case 'work_series_link':
      return applyWorkSeriesLinkChange(
        userId,
        change,
        payload as SyncWorkSeriesLinkPayloadDto,
        client,
        dependencies.userRecordsService,
      );
    case 'work_contributor':
      return applyWorkContributorChange(
        userId,
        change,
        payload as SyncWorkContributorPayloadDto,
        client,
        dependencies.userRecordsService,
      );
    case 'work_relation':
      return applyWorkRelationChange(
        userId,
        change,
        payload as SyncWorkRelationPayloadDto,
        client,
        dependencies.userRecordsService,
      );
    case 'tier_board':
      return applyTierBoardChange(
        userId,
        change,
        payload as SyncTierBoardPayloadDto,
        client,
      );
    case 'tier_lane':
      return applyTierLaneChange(
        userId,
        change,
        payload as SyncTierLanePayloadDto,
        client,
      );
    case 'tier_board_card':
      return applyTierBoardCardChange(
        userId,
        change,
        payload as SyncTierBoardCardPayloadDto,
        client,
        dependencies.userRecordsService,
      );
    case 'tier_board_asset':
      return applyTierBoardAssetChange(
        userId,
        change,
        payload as SyncTierBoardAssetPayloadDto,
        client,
      );
    case 'timeline_entry':
      return applyTimelineEntryChange(
        userId,
        change,
        payload as SyncTimelineEntryPayloadDto,
        client,
        {
          timelineEntriesService: dependencies.timelineEntriesService,
          userRecordsService: dependencies.userRecordsService,
        },
      );
    case 'release_record':
      return applyReleaseRecordChange(
        userId,
        change,
        payload as SyncReleaseRecordPayloadDto,
        client,
        {
          releaseRecordsService: dependencies.releaseRecordsService,
          userRecordsService: dependencies.userRecordsService,
        },
      );
    case 'work':
      return applyWorkChange(
        userId,
        change,
        payload as SyncWorkPayloadDto,
        client,
        {
          catalogService: dependencies.catalogService,
          userRecordsService: dependencies.userRecordsService,
        },
      );
  }
}
