import { describe, expect, it } from 'vitest';

import {
  createCsvImportTemplate,
  parseRecordsCsv,
  tokenizeCsv,
} from './csv-import.service';

describe('tokenizeCsv', () => {
  it('handles quotes, embedded commas, escaped quotes, and newlines in fields', () => {
    const rows = tokenizeCsv(
      'a,"b, with comma","c ""quoted""","d\nnewline"\r\ne,f,g,h',
    );

    expect(rows).toEqual([
      ['a', 'b, with comma', 'c "quoted"', 'd\nnewline'],
      ['e', 'f', 'g', 'h'],
    ]);
  });

  it('strips the BOM and skips blank lines', () => {
    const rows = tokenizeCsv('﻿title\n\n귀멸의 칼날\n');

    expect(rows).toEqual([['title'], ['귀멸의 칼날']]);
  });
});

describe('parseRecordsCsv', () => {
  it('parses Korean headers with type, status, rating, tags, and short review', () => {
    const csv = [
      '제목,유형,상태,별점,작가,태그,한줄평,표지',
      '전지적 독자 시점,웹소설,보는 중,4.5,싱숑,회귀; 사이다,메타적 재미,https://cover.example/1.jpg',
      '귀멸의 칼날,애니,완료,9,고토게 코요하루,,,',
    ].join('\n');

    const entries = parseRecordsCsv(csv);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      author: '싱숑',
      personalTags: ['회귀', '사이다'],
      rating: 4.5,
      shortReview: '메타적 재미',
      sourceLabel: 'CSV',
      status: 'in_progress',
      thumbnailUrl: 'https://cover.example/1.jpg',
      title: '전지적 독자 시점',
      type: 'web_novel',
    });
    // 10점제로 보이는 값은 5점제로 환산한다.
    expect(entries[1]).toMatchObject({
      rating: 4.5,
      status: 'completed',
      type: 'anime',
    });
  });

  it('reads this app\'s own CSV export format back', () => {
    const csv = [
      'title,type,status,rating,personalTags,shortReview,review,progress,startedAt,completedAt,droppedAt,lastConsumedAt,favorite,updatedAt',
      '"무빙",webtoon,planned,,"히어로; 한국","","",,,,,,"false",2026-06-01T00:00:00.000Z',
      '"귀멸의 칼날",anime,completed,4.5,"","극장판 압권","길게 쓴 감상","26 / 26 / episode",2024-01-02T00:00:00.000Z,2024-02-10T00:00:00.000Z,,,true,2026-06-01T00:00:00.000Z',
    ].join('\n');

    const entries = parseRecordsCsv(csv);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      personalTags: ['히어로', '한국'],
      rating: null,
      status: 'planned',
      title: '무빙',
      type: 'webtoon',
    });
    expect(entries[1]).toMatchObject({
      completedAt: '2024-02-10T00:00:00.000Z',
      favorite: true,
      progressCurrent: 26,
      progressTotal: 26,
      progressUnit: 'episode',
      rating: 4.5,
      review: '길게 쓴 감상',
      shortReview: '극장판 압권',
      startedAt: '2024-01-02T00:00:00.000Z',
      status: 'completed',
      title: '귀멸의 칼날',
      type: 'anime',
    });
  });

  it('defaults unknown types and statuses instead of failing', () => {
    const entries = parseRecordsCsv(
      ['제목,유형,상태', '미지의 작품,팟캐스트,듣는 중'].join('\n'),
    );

    expect(entries[0]).toMatchObject({
      status: 'planned',
      type: 'other',
    });
  });

  it('skips rows without titles and duplicate title/type pairs', () => {
    const entries = parseRecordsCsv(
      ['제목,유형', ',애니', '무빙,웹툰', '무빙,웹툰', '무빙,드라마'].join(
        '\n',
      ),
    );

    expect(entries.map((entry) => `${entry.type}:${entry.title}`)).toEqual([
      'webtoon:무빙',
      'drama:무빙',
    ]);
  });

  it('throws a friendly error when no title column exists', () => {
    expect(() => parseRecordsCsv('이름,점수\n무빙,5')).toThrow(
      'CSV에서 제목 열을 찾지 못했습니다',
    );
  });

  it('parses its own template', () => {
    const entries = parseRecordsCsv(createCsvImportTemplate());

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      title: '전지적 독자 시점',
      type: 'web_novel',
    });
  });
});
