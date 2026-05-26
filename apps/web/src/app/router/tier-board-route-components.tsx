import { lazy } from 'react';

export const TierBoardsPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardsPage,
  })),
);

export const TierBoardEditorPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardEditorPage,
  })),
);

export const TierBoardViewPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardViewPage,
  })),
);
