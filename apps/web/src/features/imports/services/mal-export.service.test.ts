import { describe, expect, it } from 'vitest';

import { parseMyAnimeListExportXml } from './mal-export.service';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_name>tester</user_name>
  </myinfo>
  <anime>
    <series_animedb_id>38000</series_animedb_id>
    <series_title><![CDATA[Kimetsu no Yaiba]]></series_title>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>26</my_watched_episodes>
    <my_start_date>2024-01-02</my_start_date>
    <my_finish_date>2024-02-10</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_comments><![CDATA[명작.]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
    <series_episodes>64</series_episodes>
    <my_watched_episodes>12</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Watching</my_status>
    <my_comments></my_comments>
  </anime>
  <manga>
    <manga_mangadb_id>116778</manga_mangadb_id>
    <manga_title><![CDATA[Mushoku Tensei]]></manga_title>
    <manga_media_type>Novel</manga_media_type>
    <manga_volumes>26</manga_volumes>
    <manga_chapters>0</manga_chapters>
    <my_read_volumes>10</my_read_volumes>
    <my_read_chapters>0</my_read_chapters>
    <my_score>7</my_score>
    <my_status>On-Hold</my_status>
  </manga>
  <manga>
    <manga_mangadb_id>121496</manga_mangadb_id>
    <manga_title><![CDATA[Solo Leveling]]></manga_title>
    <manga_volumes>0</manga_volumes>
    <manga_chapters>179</manga_chapters>
    <my_read_volumes>0</my_read_volumes>
    <my_read_chapters>179</my_read_chapters>
    <my_score>8</my_score>
    <my_status>Completed</my_status>
  </manga>
</myanimelist>`;

describe('parseMyAnimeListExportXml', () => {
  it('parses anime and manga entries with statuses, scores, and progress', () => {
    const entries = parseMyAnimeListExportXml(SAMPLE_XML);

    expect(entries).toHaveLength(4);

    expect(entries[0]).toMatchObject({
      completedAt: '2024-02-10T00:00:00.000Z',
      externalKey: 'mal:anime:38000',
      progressCurrent: 26,
      progressTotal: 26,
      progressUnit: 'episode',
      rating: 4.5,
      review: '명작.',
      sourceLabel: 'MyAnimeList',
      sourceUrl: 'https://myanimelist.net/anime/38000',
      startedAt: '2024-01-02T00:00:00.000Z',
      status: 'completed',
      thumbnailUrl: '',
      title: 'Kimetsu no Yaiba',
      type: 'anime',
    });

    expect(entries[1]).toMatchObject({
      completedAt: null,
      progressCurrent: 12,
      rating: null,
      startedAt: null,
      status: 'in_progress',
    });

    expect(entries[2]).toMatchObject({
      progressCurrent: 10,
      progressTotal: 26,
      progressUnit: 'volume',
      rating: 3.5,
      status: 'on_hold',
      title: 'Mushoku Tensei',
      type: 'light_novel',
    });

    expect(entries[3]).toMatchObject({
      progressCurrent: 179,
      progressTotal: 179,
      progressUnit: 'chapter',
      rating: 4,
      status: 'completed',
      title: 'Solo Leveling',
      type: 'manga',
    });
  });

  it('rejects files that are not a MAL export', () => {
    expect(() => parseMyAnimeListExportXml('{"not":"xml"}')).toThrow(
      'MyAnimeList 내보내기 XML 형식이 아닙니다',
    );
    expect(() =>
      parseMyAnimeListExportXml('<?xml version="1.0"?><other/>'),
    ).toThrow('MyAnimeList 내보내기 XML 형식이 아닙니다');
  });

  it('skips duplicate ids and entries without titles', () => {
    const xml = `<?xml version="1.0"?>
<myanimelist>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title>First</series_title>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title>First Again</series_title>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>2</series_animedb_id>
    <series_title></series_title>
  </anime>
</myanimelist>`;

    const entries = parseMyAnimeListExportXml(xml);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe('First');
  });
});
