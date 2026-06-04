/**
 * 웹소설·웹툰 독자가 탐색축으로 쓰는 클리셰·소재 키워드 사전.
 * 자유 personalTags 와 공존하며, 태그 입력의 자동완성·추천 칩으로 노출된다.
 * 고정 대표 장르(WORK_GENRES)와 달리 여기 키워드는 "소재/취향" 레이어다.
 */
export const WEB_NOVEL_KEYWORD_GROUPS: Array<{
  label: string;
  keywords: string[];
}> = [
  {
    label: '전개',
    keywords: [
      '회귀',
      '빙의',
      '환생',
      '차원이동',
      '책빙의',
      '게임빙의',
      '시간여행',
      '회귀자',
    ],
  },
  {
    label: '주인공',
    keywords: ['먼치킨', '성장형', '천재', '각성', '만렙', '무능력자'],
  },
  {
    label: '분위기',
    keywords: ['사이다', '고구마', '힐링', '피폐', '다크', '잔잔함', '감동'],
  },
  {
    label: '소재',
    keywords: [
      '헌터',
      '탑등반',
      '던전',
      '아카데미',
      '영지경영',
      '게임판타지',
      '시스템',
      '상태창',
      '악역영애',
      '황녀',
      '대공',
      '계약연애',
      '정략결혼',
      '재벌',
      '연예계',
      '아이돌',
      '육아',
      '요리',
      '의학',
    ],
  },
  {
    label: '관계',
    keywords: [
      '하렘',
      '역하렘',
      '집착남주',
      '후회남주',
      '첫사랑',
      '소꿉친구',
      '신분차이',
      '삼각관계',
    ],
  },
];

/** 자동완성에 합칠 전체 키워드 (평탄화). */
export const WEB_NOVEL_KEYWORDS: string[] = WEB_NOVEL_KEYWORD_GROUPS.flatMap(
  (group) => group.keywords,
);

/** 입력 폼에서 원클릭으로 제안할 대표 키워드. */
export const POPULAR_WEB_NOVEL_KEYWORDS = [
  '회귀',
  '빙의',
  '환생',
  '먼치킨',
  '사이다',
  '악역영애',
  '헌터',
  '피폐',
  '하렘',
  '육아',
];
