import type {
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import {
  blobToDataUrl,
  cacheTierBoardAssetDataUrl,
  createLocalTierBoardAssetUrl,
  dataUrlToBlob,
  getCachedTierBoardAssetDataUrl,
  MAX_TIER_BOARD_UPLOAD_BYTES,
} from './tier-board-assets';
import type { StoredTierBoardAssetRecord } from './tier-board.repository';
import { createSlug } from './tier-board-records';
import type {
  ImportIdMaps,
  TierBoardExportAsset,
  TierBoardExportDocument,
} from './tier-board.types';

export async function buildTierBoardExportAssets(
  assets: StoredTierBoardAssetRecord[],
): Promise<TierBoardExportAsset[]> {
  return Promise.all(
    assets.map<Promise<TierBoardExportAsset>>(
      async ({ blob, dataUrl, ...asset }) => {
        const cachedDataUrl =
          dataUrl ?? getCachedTierBoardAssetDataUrl(asset.id);

        if (
          asset.storageType !== 'local_blob' ||
          !blob ||
          asset.sizeBytes > MAX_TIER_BOARD_UPLOAD_BYTES
        ) {
          return cachedDataUrl &&
            asset.storageType === 'local_blob' &&
            asset.sizeBytes <= MAX_TIER_BOARD_UPLOAD_BYTES
            ? { ...asset, dataUrl: cachedDataUrl }
            : asset;
        }

        try {
          const nextDataUrl = await blobToDataUrl(blob);
          cacheTierBoardAssetDataUrl(asset.id, nextDataUrl);

          return {
            ...asset,
            dataUrl: nextDataUrl,
          };
        } catch {
          return cachedDataUrl ? { ...asset, dataUrl: cachedDataUrl } : asset;
        }
      },
    ),
  );
}

export function buildTierBoardImportRecords(
  parsed: TierBoardExportDocument,
  now: string,
) {
  const maps: ImportIdMaps = {
    boardIds: new Map([[parsed.board.id, crypto.randomUUID()]]),
    laneIds: new Map(),
    cardIds: new Map(),
  };
  const board: TierBoardRecord = {
    ...parsed.board,
    id: maps.boardIds.get(parsed.board.id)!,
    title: parsed.board.title || '가져온 티어보드',
    slug: createSlug(parsed.board.title || '가져온 티어보드'),
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
  const lanes = parsed.lanes.map<TierLaneRecord>((lane) => {
    const id = crypto.randomUUID();
    maps.laneIds.set(lane.id, id);

    return {
      ...lane,
      id,
      boardId: board.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };
  });
  const oldCardIdByNewCardId = new Map<string, string>();
  const cards = parsed.cards.map<TierBoardCardRecord>((card) => {
    const id = crypto.randomUUID();
    maps.cardIds.set(card.id, id);
    oldCardIdByNewCardId.set(id, card.id);

    return {
      ...card,
      id,
      boardId: board.id,
      laneId: card.laneId ? (maps.laneIds.get(card.laneId) ?? null) : null,
      workId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };
  });
  const cardImageUrlByOldCardId = new Map(
    parsed.cards.map((card) => [card.id, card.imageUrl]),
  );
  const localAssetUrlRemaps = new Map<string, string>();
  const localAssetMissingUrls = new Set<string>();
  const assets = parsed.assets.map<StoredTierBoardAssetRecord>((asset) => {
    const { dataUrl, ...assetRecord } = asset;
    const id = crypto.randomUUID();
    const objectUrl =
      assetRecord.storageType === 'local_blob'
        ? createLocalTierBoardAssetUrl(id)
        : assetRecord.objectUrl;
    let blob: Blob | null = null;

    if (assetRecord.storageType === 'local_blob' && dataUrl) {
      try {
        blob = dataUrlToBlob(dataUrl);
        localAssetUrlRemaps.set(assetRecord.objectUrl, objectUrl);
      } catch {
        localAssetMissingUrls.add(assetRecord.objectUrl);
      }
    } else if (assetRecord.storageType === 'local_blob') {
      localAssetMissingUrls.add(assetRecord.objectUrl);
    }

    const importedAsset: StoredTierBoardAssetRecord = {
      ...assetRecord,
      id,
      boardId: board.id,
      cardId: assetRecord.cardId
        ? (maps.cardIds.get(assetRecord.cardId) ?? null)
        : null,
      objectUrl:
        assetRecord.storageType === 'local_blob' && !blob ? '' : objectUrl,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      blob,
    };

    if (blob && dataUrl) {
      importedAsset.dataUrl = dataUrl;
      cacheTierBoardAssetDataUrl(id, dataUrl);
    }

    return importedAsset;
  });
  const cardsWithResolvedImages = cards.map<TierBoardCardRecord>((card) => {
    const oldCardId = oldCardIdByNewCardId.get(card.id);
    const oldImageUrl = oldCardId
      ? cardImageUrlByOldCardId.get(oldCardId)
      : card.imageUrl;

    if (oldImageUrl && localAssetUrlRemaps.has(oldImageUrl)) {
      return {
        ...card,
        imageUrl: localAssetUrlRemaps.get(oldImageUrl)!,
      };
    }

    if (oldImageUrl && localAssetMissingUrls.has(oldImageUrl)) {
      return {
        ...card,
        imageUrl: '',
      };
    }

    return card;
  });

  return {
    assets,
    board,
    cards: cardsWithResolvedImages,
    lanes,
  };
}
