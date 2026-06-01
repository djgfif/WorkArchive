export const MAX_TIER_BOARD_UPLOAD_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_TIER_BOARD_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const localAssetDataUrlCache = new Map<string, string>();

export function cacheTierBoardAssetDataUrl(assetId: string, dataUrl: string) {
  localAssetDataUrlCache.set(assetId, dataUrl);
}

export function getCachedTierBoardAssetDataUrl(assetId: string) {
  return localAssetDataUrlCache.get(assetId);
}

export function createLocalTierBoardAssetUrl(assetId: string) {
  return `indexeddb://tier-board-assets/${assetId}`;
}

export function blobToDataUrl(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const base64 = bytesToBase64(bytes);

      return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
    });
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(reader.error ?? new Error('이미지 데이터를 읽지 못했습니다.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('이미지 데이터를 읽지 못했습니다.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from(input: Uint8Array): { toString(encoding: 'base64'): string };
      };
    }
  ).Buffer;

  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: { from(input: string, encoding: 'base64'): Uint8Array };
    }
  ).Buffer;

  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw new Error('지원하지 않는 이미지 데이터 형식입니다.');
  }

  const mimeType = match[1];
  const base64 = match[2];

  if (
    !mimeType ||
    !base64 ||
    !SUPPORTED_TIER_BOARD_UPLOAD_MIME_TYPES.has(mimeType)
  ) {
    throw new Error('지원하지 않는 이미지 MIME 타입입니다.');
  }

  const bytes = base64ToBytes(base64);

  if (bytes.byteLength > MAX_TIER_BOARD_UPLOAD_BYTES) {
    throw new Error('이미지 파일은 5MB 이하만 가져올 수 있습니다.');
  }

  return new Blob([bytes], { type: mimeType });
}

export async function fileToBlob(file: File) {
  if (typeof file.arrayBuffer === 'function') {
    return new Blob([await file.arrayBuffer()], { type: file.type });
  }

  return new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(reader.error ?? new Error('이미지 파일을 읽지 못했습니다.'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('이미지 파일을 읽지 못했습니다.'));
        return;
      }
      resolve(new Blob([reader.result], { type: file.type }));
    };
    reader.readAsArrayBuffer(file);
  });
}
