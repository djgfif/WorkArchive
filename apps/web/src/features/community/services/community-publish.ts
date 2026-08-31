import type {
  CreateCommunityPostRequest,
  WorkRecord,
} from '@work-archive/shared-types';

type PublicWorkSnapshot = Pick<WorkRecord, 'thumbnailUrl' | 'title' | 'type'>;

function safePublicThumbnailUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildCommunityPostInput(
  body: string,
  spoiler: boolean,
  work: PublicWorkSnapshot | null,
): CreateCommunityPostRequest {
  if (!work) {
    return { body: body.trim(), spoiler };
  }

  const thumbnailUrl = safePublicThumbnailUrl(work.thumbnailUrl);

  return {
    body: body.trim(),
    spoiler,
    ...(thumbnailUrl ? { workThumbnailUrl: thumbnailUrl } : {}),
    workTitle: work.title,
    workType: work.type,
  };
}
