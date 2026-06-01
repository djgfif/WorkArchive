import type {
  SyncOperation,
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import type { SyncQueueRepository } from '../../sync/queue';
import type { StoredTierBoardAssetRecord } from './tier-board.repository';
import type {
  TierBoardAssetChangeSource,
  TierBoardChangeSource,
} from './tier-board.types';

export class TierBoardSyncQueueWriter {
  constructor(private readonly queueRepository: SyncQueueRepository) {}

  enqueueBoard(
    board: TierBoardRecord,
    operation: SyncOperation,
    source: TierBoardChangeSource = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board',
      board,
      operation,
      { ...board },
      source,
    );
  }

  enqueueBoardInOpenTransaction(
    board: TierBoardRecord,
    operation: SyncOperation,
    source: TierBoardChangeSource = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board',
      board,
      operation,
      { ...board },
      source,
    );
  }

  enqueueLaneInOpenTransaction(
    lane: TierLaneRecord,
    operation: SyncOperation,
    source: TierBoardChangeSource = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_lane',
      lane,
      operation,
      { ...lane },
      source,
    );
  }

  enqueueCardInOpenTransaction(
    card: TierBoardCardRecord,
    operation: SyncOperation,
    source: TierBoardChangeSource = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board_card',
      card,
      operation,
      { ...card },
      source,
    );
  }

  enqueueAssetInOpenTransaction(
    asset: StoredTierBoardAssetRecord,
    operation: SyncOperation,
    source: TierBoardAssetChangeSource = 'tier_board_asset_update',
  ) {
    const { blob: _blob, dataUrl: _dataUrl, ...payload } = asset;

    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board_asset',
      payload,
      operation,
      payload,
      source,
    );
  }
}
