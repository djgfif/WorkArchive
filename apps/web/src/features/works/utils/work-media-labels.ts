import type { WorkType } from '@work-archive/shared-types';

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

const defaultLabels: WorkMediaFieldLabels = {
  authorEmptyLabel: '주요 제작자 미입력',
  authorLabel: '작가 / 제작자',
  authorPlaceholder: '예: 작가, 감독, 제작사',
  creatorLabel: '주요 제작진',
  creatorPlaceholder: '작가, 원작자, 감독 등',
  platformLabel: '플랫폼 / 서비스',
  platformPlaceholder: '예: Netflix, 왓챠, 리디',
  publisherLabel: '출판사 / 배급사',
  publisherPlaceholder: '예: Kadokawa, CJ ENM',
  seriesDescription: '같은 제목 계열로 이어지는 작품을 묶습니다.',
  seriesLabel: '시리즈명',
  seriesPlaceholder: '예: Fate, 해리포터',
  showStudioField: true,
  studioLabel: '제작사 / 스튜디오',
  studioPlaceholder: '예: ufotable, MAPPA',
  universeDescription: '동일한 세계관이나 프랜차이즈에 속한 작품을 묶습니다.',
  universeLabel: '세계관 / 프랜차이즈',
  universePlaceholder: '예: TYPE-MOON, Wizarding World',
};

const labelsByType: Partial<Record<WorkType, Partial<WorkMediaFieldLabels>>> = {
  anime: {
    authorEmptyLabel: '스튜디오/원작자 미입력',
    authorLabel: '원작자 / 스튜디오',
    authorPlaceholder: '예: Kanehito Yamada, Madhouse',
    creatorLabel: '원작자 / 감독 / 각본',
    creatorPlaceholder: '예: 원작자, 감독, 시리즈 구성',
    platformLabel: '방영 / 스트리밍',
    platformPlaceholder: '예: TV Tokyo, Netflix, Crunchyroll',
    publisherLabel: '제작위원회 / 배급',
    publisherPlaceholder: '예: Aniplex, TOHO animation',
    seriesPlaceholder: '예: Fate/stay night, 기동전사 건담',
    studioLabel: '애니메이션 제작사',
    studioPlaceholder: '예: ufotable, MAPPA, Kyoto Animation',
  },
  manga: {
    authorEmptyLabel: '작가 미입력',
    authorLabel: '작가',
    authorPlaceholder: '예: 아라카와 히로무',
    creatorLabel: '글 / 그림 / 원작',
    creatorPlaceholder: '예: 스토리 작가, 작화가, 원작자',
    platformLabel: '연재지 / 플랫폼',
    platformPlaceholder: '예: 주간 소년 점프, 코미코',
    publisherLabel: '출판사',
    publisherPlaceholder: '예: Shueisha, 대원씨아이',
    seriesPlaceholder: '예: 강철의 연금술사',
    showStudioField: false,
  },
  novel: {
    authorEmptyLabel: '저자 미입력',
    authorLabel: '저자',
    authorPlaceholder: '예: Frank Herbert',
    creatorLabel: '저자',
    creatorPlaceholder: '예: Frank Herbert',
    platformLabel: '판본 / 유통처',
    platformPlaceholder: '예: 민음사 세계문학, 리디북스',
    publisherLabel: '출판사',
    publisherPlaceholder: '예: 문학동네, Penguin Books',
    seriesPlaceholder: '예: 듄',
    showStudioField: false,
  },
  light_novel: {
    authorEmptyLabel: '작가 미입력',
    authorLabel: '작가',
    authorPlaceholder: '예: 카마치 카즈마',
    creatorLabel: '작가',
    creatorPlaceholder: '예: 카마치 카즈마',
    platformLabel: '레이블 / 유통처',
    platformPlaceholder: '예: 전격문고, 리디북스',
    publisherLabel: '출판사',
    publisherPlaceholder: '예: KADOKAWA, 학산문화사',
    seriesPlaceholder: '예: 어떤 마술의 금서목록',
    showStudioField: false,
  },
  web_novel: {
    authorEmptyLabel: '작가 미입력',
    authorLabel: '작가',
    authorPlaceholder: '예: 싱숑',
    creatorLabel: '작가',
    creatorPlaceholder: '예: 연재 작가',
    platformLabel: '연재 플랫폼',
    platformPlaceholder: '예: 문피아, 카카오페이지, 네이버시리즈',
    publisherLabel: '출판 / 서비스사',
    publisherPlaceholder: '예: 문피아, KW북스',
    seriesPlaceholder: '예: 전지적 독자 시점',
    showStudioField: false,
  },
  webtoon: {
    authorEmptyLabel: '작가 미입력',
    authorLabel: '작가',
    authorPlaceholder: '예: 글 작가, 그림 작가',
    creatorLabel: '글 / 그림 / 원작',
    creatorPlaceholder: '예: 글 작가, 그림 작가, 원작자',
    platformLabel: '연재 플랫폼',
    platformPlaceholder: '예: 네이버웹툰, 카카오웹툰',
    publisherLabel: '제작사 / 에이전시',
    publisherPlaceholder: '예: YLAB, 재담미디어',
    seriesPlaceholder: '예: 신의 탑',
    showStudioField: false,
  },
  movie: {
    authorEmptyLabel: '감독/제작사 미입력',
    authorLabel: '감독 / 제작사',
    authorPlaceholder: '예: 봉준호, Barunson E&A',
    creatorLabel: '감독 / 각본 / 원작',
    creatorPlaceholder: '예: 감독, 각본가, 원작자',
    platformLabel: '관람 / 스트리밍',
    platformPlaceholder: '예: 극장, Netflix',
    publisherLabel: '배급사',
    publisherPlaceholder: '예: CJ ENM, A24',
    seriesPlaceholder: '예: 존 윅',
    studioLabel: '제작사',
    studioPlaceholder: '예: Barunson E&A, Warner Bros.',
  },
  drama: {
    authorEmptyLabel: '방송사/제작사 미입력',
    authorLabel: '방송사 / 제작사',
    authorPlaceholder: '예: tvN, Studio Dragon',
    creatorLabel: '연출 / 극본 / 원작',
    creatorPlaceholder: '예: 연출, 극본, 원작자',
    platformLabel: '방영 / 스트리밍',
    platformPlaceholder: '예: tvN, Netflix, Disney+',
    publisherLabel: '방송사 / 배급',
    publisherPlaceholder: '예: tvN, JTBC',
    seriesPlaceholder: '예: 응답하라 시리즈',
    studioLabel: '제작사',
    studioPlaceholder: '예: Studio Dragon, SLL',
  },
};

export function getWorkMediaFieldLabels(type: WorkType): WorkMediaFieldLabels {
  return {
    ...defaultLabels,
    ...labelsByType[type],
  };
}
