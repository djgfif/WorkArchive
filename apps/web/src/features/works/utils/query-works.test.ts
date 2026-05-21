import { describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import { queryWorks } from './query-works';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'novel',
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('queryWorks', () => {
  const works = [
    buildWork({
      title: 'Bleach',
      author: 'Tite Kubo',
      type: 'manga',
      status: 'in_progress',
      rating: 4,
      updatedAt: '2026-01-05T00:00:00.000Z',
    }),
    buildWork({
      title: 'Dune',
      author: 'Frank Herbert',
      type: 'novel',
      status: 'completed',
      rating: 5,
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
    buildWork({
      title: 'Your Name',
      author: 'Makoto Shinkai',
      type: 'movie',
      status: 'planned',
      rating: 3.5,
      updatedAt: '2026-01-04T00:00:00.000Z',
    }),
  ];

  it('searches by title and author', () => {
    expect(
      queryWorks(works, {
        rating: null,
        searchTerm: 'frank',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      }),
    ).toHaveLength(1);

    expect(
      queryWorks(works, {
        rating: null,
        searchTerm: 'bleach',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      })[0]?.title,
    ).toBe('Bleach');
  });

  it('does not search private review text from the general search box', () => {
    const reviewOnlyWorks = [
      buildWork({
        title: 'Frieren',
        author: 'Kanehito Yamada',
        description: 'quiet-note',
        shortReview: 'hidden-short-review',
        review: 'hidden-long-review',
      }),
    ];

    for (const searchTerm of [
      'quiet-note',
      'hidden-short-review',
      'hidden-long-review',
    ]) {
      expect(
        queryWorks(reviewOnlyWorks, {
          rating: null,
          searchTerm,
          type: 'all',
          status: 'all',
          sortBy: 'updatedAt',
        }),
      ).toHaveLength(0);
    }
  });

  it('searches and filters by personal tags without mixing them with type or status', () => {
    const taggedWorks = [
      buildWork({
        title: 'Steins;Gate',
        personalTags: ['시간여행', '다시 볼 것'],
      }),
      buildWork({
        title: 'Dune',
        personalTags: ['인생작 후보'],
      }),
    ];

    expect(
      queryWorks(taggedWorks, {
        rating: null,
        searchTerm: '시간여행',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Steins;Gate']);

    expect(
      queryWorks(taggedWorks, {
        rating: null,
        searchTerm: '',
        tag: '인생작 후보',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Dune']);
  });

  it('filters by graph tags without exposing prefixed tags as personal tags', () => {
    const graphWorks = [
      buildWork({
        title: 'Fate/stay night',
        type: 'anime',
        status: 'completed',
        genres: ['Fantasy'],
        personalTags: ['series:Fate', 'studio:ufotable', 'rewatch'],
      }),
      buildWork({
        title: 'Dune',
        type: 'novel',
        status: 'planned',
        genres: ['Science Fiction'],
        personalTags: ['series:Dune', 'creator:Frank Herbert'],
      }),
    ];

    expect(
      queryWorks(graphWorks, {
        rating: null,
        searchTerm: '',
        series: 'Fate',
        contributor: 'ufotable',
        genre: 'Fantasy',
        type: 'anime',
        status: 'completed',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Fate/stay night']);

    expect(
      queryWorks(graphWorks, {
        rating: null,
        searchTerm: '',
        tag: 'series:Fate',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }),
    ).toHaveLength(0);

    expect(
      queryWorks(graphWorks, {
        rating: null,
        searchTerm: 'ufotable',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Fate/stay night']);
  });

  it('matches Korean titles across spacing, symbols, and trailing subtitles', () => {
    const koreanWorks = [
      buildWork({
        title: '나 혼자만 레벨업 (외전)',
        author: '추공',
        genres: ['웹소설', '현대 판타지'],
        personalTags: ['재독 후보'],
      }),
      buildWork({
        title: '귀멸의 칼날',
        author: '고토게 코요하루',
        genres: ['만화'],
      }),
    ];

    expect(
      queryWorks(koreanWorks, {
        rating: null,
        searchTerm: '나혼자만레벨업',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['나 혼자만 레벨업 (외전)']);

    expect(
      queryWorks(koreanWorks, {
        rating: null,
        searchTerm: '귀 멸 의 칼날',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['귀멸의 칼날']);

    expect(
      queryWorks(koreanWorks, {
        rating: null,
        searchTerm: '현대-판타지',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['나 혼자만 레벨업 (외전)']);
  });

  it('filters by type and status', () => {
    const filtered = queryWorks(works, {
      rating: null,
      searchTerm: '',
      type: 'manga',
      status: 'in_progress',
      sortBy: 'updatedAt',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe('Bleach');
  });

  it('filters dropped records by the visible status filter', () => {
    const statusWorks = [
      buildWork({ title: 'Dropped Work', status: 'dropped' }),
      buildWork({ title: 'Current Work', status: 'in_progress' }),
    ];

    expect(
      queryWorks(statusWorks, {
        rating: null,
        searchTerm: '',
        type: 'all',
        status: 'dropped',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Dropped Work']);
  });

  it('separates person and organization contributor filters', () => {
    const contributorWorks = [
      buildWork({
        title: 'Author Work',
        author: 'Frank Herbert',
        personalTags: ['creator:Frank Herbert'],
      }),
      buildWork({
        title: 'Studio Work',
        author: 'Studio Label',
        personalTags: ['studio:ufotable'],
      }),
    ];

    expect(
      queryWorks(contributorWorks, {
        rating: null,
        searchTerm: '',
        personContributor: 'Frank Herbert',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Author Work']);

    expect(
      queryWorks(contributorWorks, {
        rating: null,
        searchTerm: '',
        organizationContributor: 'ufotable',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Studio Work']);

    expect(
      queryWorks(contributorWorks, {
        rating: null,
        searchTerm: '',
        organizationContributor: 'Frank Herbert',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }),
    ).toHaveLength(0);
  });

  it('filters by exact rating', () => {
    expect(
      queryWorks(works, {
        rating: 5,
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      }).map((work) => work.title),
    ).toEqual(['Dune']);
  });

  it('sorts by rating, title, and updatedAt', () => {
    expect(
      queryWorks(works, {
        rating: null,
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'rating',
      }).map((work) => work.title),
    ).toEqual(['Dune', 'Bleach', 'Your Name']);

    expect(
      queryWorks(works, {
        rating: null,
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'title',
      }).map((work) => work.title),
    ).toEqual(['Bleach', 'Dune', 'Your Name']);

    expect(
      queryWorks(works, {
        rating: null,
        searchTerm: '',
        type: 'all',
        status: 'all',
        sortBy: 'updatedAt',
      }).map((work) => work.title),
    ).toEqual(['Bleach', 'Your Name', 'Dune']);
  });
});
