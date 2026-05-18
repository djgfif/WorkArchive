import type { WorkRecord } from '@work-archive/shared-types';

import { WorkPosterCard } from './ArchiveComponents';

interface PosterTileProps {
  work: WorkRecord;
}

export function PosterTile({ work }: PosterTileProps) {
  return <WorkPosterCard work={work} />;
}
