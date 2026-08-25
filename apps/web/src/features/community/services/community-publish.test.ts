import { describe, expect, it } from 'vitest';

import { buildCommunityPostInput } from './community-publish';

describe('buildCommunityPostInput', () => {
  it('publishes only the new body and an explicit public work snapshot', () => {
    const input = buildCommunityPostInput('  새로 작성한 감상만 공개  ', true, {
      thumbnailUrl: 'https://images.example.test/cover.jpg',
      title: '공개할 작품 제목',
      type: 'novel',
    });

    expect(input).toEqual({
      body: '새로 작성한 감상만 공개',
      spoiler: true,
      workThumbnailUrl: 'https://images.example.test/cover.jpg',
      workTitle: '공개할 작품 제목',
      workType: 'novel',
    });
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('review');
    expect(input).not.toHaveProperty('rating');
    expect(input).not.toHaveProperty('progress');
    expect(input).not.toHaveProperty('tags');
  });

  it('drops non-HTTPS local or remote thumbnail references', () => {
    expect(
      buildCommunityPostInput('감상', false, {
        thumbnailUrl: 'blob:http://localhost/private-cover',
        title: '제목',
        type: 'anime',
      }),
    ).toEqual({
      body: '감상',
      spoiler: false,
      workTitle: '제목',
      workType: 'anime',
    });
  });

  it('does not attach a work snapshot without an explicit selection', () => {
    expect(buildCommunityPostInput('  작품 없는 감상  ', false, null)).toEqual({
      body: '작품 없는 감상',
      spoiler: false,
    });
  });
});
