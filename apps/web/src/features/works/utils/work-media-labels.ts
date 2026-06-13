import type { WorkType } from '@work-archive/shared-types';

import { appI18n, type AppTranslationKey } from '@app/i18n';

interface WorkMediaFieldLabels {
  authorEmptyLabel: string;
  authorLabel: string;
  authorPlaceholder: string;
  creatorLabel: string;
  creatorPlaceholder: string;
  platformLabel: string;
  platformPlaceholder: string;
  publisherLabel: string;
  publisherPlaceholder: string;
  seriesDescription: string;
  seriesLabel: string;
  seriesPlaceholder: string;
  showStudioField: boolean;
  studioLabel: string;
  studioPlaceholder: string;
  universeDescription: string;
  universeLabel: string;
  universePlaceholder: string;
}

type MediaTextField = Exclude<keyof WorkMediaFieldLabels, 'showStudioField'>;
type MediaTextKeyMap = Record<MediaTextField, AppTranslationKey>;

type MediaFieldConfig = Partial<MediaTextKeyMap> & {
  showStudioField?: boolean;
};

const defaultLabelKeys = {
  authorEmptyLabel: 'works.media.default.authorEmptyLabel',
  authorLabel: 'works.media.default.authorLabel',
  authorPlaceholder: 'works.media.default.authorPlaceholder',
  creatorLabel: 'works.media.default.creatorLabel',
  creatorPlaceholder: 'works.media.default.creatorPlaceholder',
  platformLabel: 'works.media.default.platformLabel',
  platformPlaceholder: 'works.media.default.platformPlaceholder',
  publisherLabel: 'works.media.default.publisherLabel',
  publisherPlaceholder: 'works.media.default.publisherPlaceholder',
  seriesDescription: 'works.media.default.seriesDescription',
  seriesLabel: 'works.media.default.seriesLabel',
  seriesPlaceholder: 'works.media.default.seriesPlaceholder',
  studioLabel: 'works.media.default.studioLabel',
  studioPlaceholder: 'works.media.default.studioPlaceholder',
  universeDescription: 'works.media.default.universeDescription',
  universeLabel: 'works.media.default.universeLabel',
  universePlaceholder: 'works.media.default.universePlaceholder',
} satisfies MediaTextKeyMap;

const labelsByType: Partial<Record<WorkType, MediaFieldConfig>> = {
  anime: {
    authorEmptyLabel: 'works.media.anime.authorEmptyLabel',
    authorLabel: 'works.media.anime.authorLabel',
    authorPlaceholder: 'works.media.anime.authorPlaceholder',
    creatorLabel: 'works.media.anime.creatorLabel',
    creatorPlaceholder: 'works.media.anime.creatorPlaceholder',
    platformLabel: 'works.media.anime.platformLabel',
    platformPlaceholder: 'works.media.anime.platformPlaceholder',
    publisherLabel: 'works.media.anime.publisherLabel',
    publisherPlaceholder: 'works.media.anime.publisherPlaceholder',
    seriesPlaceholder: 'works.media.anime.seriesPlaceholder',
    studioLabel: 'works.media.anime.studioLabel',
    studioPlaceholder: 'works.media.anime.studioPlaceholder',
  },
  drama: {
    authorEmptyLabel: 'works.media.drama.authorEmptyLabel',
    authorLabel: 'works.media.drama.authorLabel',
    authorPlaceholder: 'works.media.drama.authorPlaceholder',
    creatorLabel: 'works.media.drama.creatorLabel',
    creatorPlaceholder: 'works.media.drama.creatorPlaceholder',
    platformLabel: 'works.media.drama.platformLabel',
    platformPlaceholder: 'works.media.drama.platformPlaceholder',
    publisherLabel: 'works.media.drama.publisherLabel',
    publisherPlaceholder: 'works.media.drama.publisherPlaceholder',
    seriesPlaceholder: 'works.media.drama.seriesPlaceholder',
    studioLabel: 'works.media.drama.studioLabel',
    studioPlaceholder: 'works.media.drama.studioPlaceholder',
  },
  light_novel: {
    authorEmptyLabel: 'works.media.lightNovel.authorEmptyLabel',
    authorLabel: 'works.media.lightNovel.authorLabel',
    authorPlaceholder: 'works.media.lightNovel.authorPlaceholder',
    creatorLabel: 'works.media.lightNovel.creatorLabel',
    creatorPlaceholder: 'works.media.lightNovel.creatorPlaceholder',
    platformLabel: 'works.media.lightNovel.platformLabel',
    platformPlaceholder: 'works.media.lightNovel.platformPlaceholder',
    publisherLabel: 'works.media.lightNovel.publisherLabel',
    publisherPlaceholder: 'works.media.lightNovel.publisherPlaceholder',
    seriesPlaceholder: 'works.media.lightNovel.seriesPlaceholder',
    showStudioField: false,
  },
  manga: {
    authorEmptyLabel: 'works.media.manga.authorEmptyLabel',
    authorLabel: 'works.media.manga.authorLabel',
    authorPlaceholder: 'works.media.manga.authorPlaceholder',
    creatorLabel: 'works.media.manga.creatorLabel',
    creatorPlaceholder: 'works.media.manga.creatorPlaceholder',
    platformLabel: 'works.media.manga.platformLabel',
    platformPlaceholder: 'works.media.manga.platformPlaceholder',
    publisherLabel: 'works.media.manga.publisherLabel',
    publisherPlaceholder: 'works.media.manga.publisherPlaceholder',
    seriesPlaceholder: 'works.media.manga.seriesPlaceholder',
    showStudioField: false,
  },
  movie: {
    authorEmptyLabel: 'works.media.movie.authorEmptyLabel',
    authorLabel: 'works.media.movie.authorLabel',
    authorPlaceholder: 'works.media.movie.authorPlaceholder',
    creatorLabel: 'works.media.movie.creatorLabel',
    creatorPlaceholder: 'works.media.movie.creatorPlaceholder',
    platformLabel: 'works.media.movie.platformLabel',
    platformPlaceholder: 'works.media.movie.platformPlaceholder',
    publisherLabel: 'works.media.movie.publisherLabel',
    publisherPlaceholder: 'works.media.movie.publisherPlaceholder',
    seriesPlaceholder: 'works.media.movie.seriesPlaceholder',
    studioLabel: 'works.media.movie.studioLabel',
    studioPlaceholder: 'works.media.movie.studioPlaceholder',
  },
  novel: {
    authorEmptyLabel: 'works.media.novel.authorEmptyLabel',
    authorLabel: 'works.media.novel.authorLabel',
    authorPlaceholder: 'works.media.novel.authorPlaceholder',
    creatorLabel: 'works.media.novel.creatorLabel',
    creatorPlaceholder: 'works.media.novel.creatorPlaceholder',
    platformLabel: 'works.media.novel.platformLabel',
    platformPlaceholder: 'works.media.novel.platformPlaceholder',
    publisherLabel: 'works.media.novel.publisherLabel',
    publisherPlaceholder: 'works.media.novel.publisherPlaceholder',
    seriesPlaceholder: 'works.media.novel.seriesPlaceholder',
    showStudioField: false,
  },
  web_novel: {
    authorEmptyLabel: 'works.media.webNovel.authorEmptyLabel',
    authorLabel: 'works.media.webNovel.authorLabel',
    authorPlaceholder: 'works.media.webNovel.authorPlaceholder',
    creatorLabel: 'works.media.webNovel.creatorLabel',
    creatorPlaceholder: 'works.media.webNovel.creatorPlaceholder',
    platformLabel: 'works.media.webNovel.platformLabel',
    platformPlaceholder: 'works.media.webNovel.platformPlaceholder',
    publisherLabel: 'works.media.webNovel.publisherLabel',
    publisherPlaceholder: 'works.media.webNovel.publisherPlaceholder',
    seriesPlaceholder: 'works.media.webNovel.seriesPlaceholder',
    showStudioField: false,
  },
  webtoon: {
    authorEmptyLabel: 'works.media.webtoon.authorEmptyLabel',
    authorLabel: 'works.media.webtoon.authorLabel',
    authorPlaceholder: 'works.media.webtoon.authorPlaceholder',
    creatorLabel: 'works.media.webtoon.creatorLabel',
    creatorPlaceholder: 'works.media.webtoon.creatorPlaceholder',
    platformLabel: 'works.media.webtoon.platformLabel',
    platformPlaceholder: 'works.media.webtoon.platformPlaceholder',
    publisherLabel: 'works.media.webtoon.publisherLabel',
    publisherPlaceholder: 'works.media.webtoon.publisherPlaceholder',
    seriesPlaceholder: 'works.media.webtoon.seriesPlaceholder',
    showStudioField: false,
  },
};

function tLabel(key: AppTranslationKey) {
  return appI18n.t(key);
}

export function getWorkMediaFieldLabels(type: WorkType): WorkMediaFieldLabels {
  const labelKeys = {
    ...defaultLabelKeys,
    ...labelsByType[type],
  };

  return {
    authorEmptyLabel: tLabel(labelKeys.authorEmptyLabel),
    authorLabel: tLabel(labelKeys.authorLabel),
    authorPlaceholder: tLabel(labelKeys.authorPlaceholder),
    creatorLabel: tLabel(labelKeys.creatorLabel),
    creatorPlaceholder: tLabel(labelKeys.creatorPlaceholder),
    platformLabel: tLabel(labelKeys.platformLabel),
    platformPlaceholder: tLabel(labelKeys.platformPlaceholder),
    publisherLabel: tLabel(labelKeys.publisherLabel),
    publisherPlaceholder: tLabel(labelKeys.publisherPlaceholder),
    seriesDescription: tLabel(labelKeys.seriesDescription),
    seriesLabel: tLabel(labelKeys.seriesLabel),
    seriesPlaceholder: tLabel(labelKeys.seriesPlaceholder),
    showStudioField: labelKeys.showStudioField ?? true,
    studioLabel: tLabel(labelKeys.studioLabel),
    studioPlaceholder: tLabel(labelKeys.studioPlaceholder),
    universeDescription: tLabel(labelKeys.universeDescription),
    universeLabel: tLabel(labelKeys.universeLabel),
    universePlaceholder: tLabel(labelKeys.universePlaceholder),
  };
}
