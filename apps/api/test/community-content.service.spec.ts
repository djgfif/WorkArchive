import { CommunityPostStatus, CommunityPostSurface } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CommunityService } from '../src/modules/community/community.service';
import {
  createCommunityTestContext,
  createPostRow,
  type CommunityPrismaMock,
} from './community-service.fixtures';

describe('Community content services', () => {
  let prisma: CommunityPrismaMock;
  let service: CommunityService;

  beforeEach(() => {
    ({ prisma, service } = createCommunityTestContext());
  });

  it('lists only published posts and derives viewer permissions without exposing user ids', async () => {
    prisma.communityPost.findMany.mockResolvedValue([createPostRow()]);

    const result = await service.listPosts(
      { limit: 20, sort: 'latest' },
      'user-1',
    );

    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: CommunityPostStatus.published,
          surface: CommunityPostSurface.board,
        },
        take: 21,
      }),
    );
    expect(result.posts[0]).toEqual(
      expect.objectContaining({
        viewerCanDelete: true,
        viewerHasReacted: true,
        work: {
          thumbnailUrl: 'https://example.com/work.jpg',
          title: '여름의 문장들',
          type: 'novel',
        },
      }),
    );
    expect(result.posts[0]).not.toHaveProperty('authorId');
    expect(result.posts[0]?.author).not.toHaveProperty('email');
  });

  it('uses the indexed scalar reaction count for deterministic popular ordering', async () => {
    prisma.communityPost.findMany.mockResolvedValue([createPostRow()]);

    await service.listPosts({ limit: 20, sort: 'popular' }, null);

    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { reactionCount: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });

  it('queries and writes reflections only through the reflection surface', async () => {
    prisma.communityPost.findMany.mockResolvedValue([
      createPostRow({ surface: CommunityPostSurface.reflection }),
    ]);
    prisma.communityPost.create.mockResolvedValue(
      createPostRow({
        reactionCount: 0,
        reactions: [],
        surface: CommunityPostSurface.reflection,
      }),
    );

    await service.listPosts(
      { limit: 20, sort: 'latest' },
      null,
      CommunityPostSurface.reflection,
    );
    await service.createPost(
      'user-1',
      { body: '짧은 공개 감상' },
      CommunityPostSurface.reflection,
    );

    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          surface: CommunityPostSurface.reflection,
        }),
      }),
    );
    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'free',
          surface: CommunityPostSurface.reflection,
        }),
      }),
    );
  });

  it('publishes only the explicit body and bounded work snapshot', async () => {
    prisma.communityPost.create.mockResolvedValue(
      createPostRow({ reactionCount: 0, reactions: [] }),
    );

    await service.createPost('user-1', {
      body: '  새로 쓴 공개 감상  ',
      spoiler: true,
      workThumbnailUrl:
        'https://reader:secret@s4.anilist.co/file/work.jpg#private-fragment',
      workTitle: '  여름의 문장들  ',
      workType: 'novel',
    });

    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: 'user-1',
          body: '새로 쓴 공개 감상',
          catalogTitleId: null,
          category: 'free',
          spoiler: true,
          surface: CommunityPostSurface.board,
          workThumbnailUrl: 'https://s4.anilist.co/file/work.jpg',
          workTitle: '여름의 문장들',
          workType: 'novel',
        },
      }),
    );
  });

  it('rejects an author-controlled thumbnail host before writing a public post', async () => {
    await expect(
      service.createPost('user-1', {
        body: '공개 감상',
        workThumbnailUrl: 'https://tracker.example.test/pixel.gif',
        workTitle: '추적 표지',
        workType: 'novel',
      }),
    ).rejects.toThrow('Image host is not allowed.');
    expect(prisma.communityPost.create).not.toHaveBeenCalled();
  });

  it('rejects partial work snapshots instead of accepting ambiguous publication data', async () => {
    await expect(
      service.createPost('user-1', {
        body: '공개 감상',
        workTitle: '제목만 있음',
      }),
    ).rejects.toThrow('requires title and type');
    expect(prisma.communityPost.create).not.toHaveBeenCalled();
  });

  it('soft-deletes only a published post owned by the current author', async () => {
    prisma.communityPost.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.deletePost('user-2', 'post-1')).rejects.toThrow(
      'Community post not found.',
    );
    expect(prisma.communityPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authorId: 'user-2',
          id: 'post-1',
          status: CommunityPostStatus.published,
          surface: CommunityPostSurface.board,
        },
      }),
    );
  });

  it('keeps reactions idempotent and scoped to the current user', async () => {
    const transaction = {
      communityPost: {
        findFirst: jest.fn(async (_input: unknown) => ({ id: 'post-1' })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
      },
      communityReaction: {
        createMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
        deleteMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await service.addReaction('user-2', 'post-1');
    await service.removeReaction('user-2', 'post-1');

    expect(transaction.communityReaction.createMany).toHaveBeenCalledWith({
      data: [{ postId: 'post-1', userId: 'user-2' }],
      skipDuplicates: true,
    });
    expect(transaction.communityReaction.deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', userId: 'user-2' },
    });
    expect(transaction.communityPost.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: { reactionCount: { increment: 1 } },
      }),
    );
    expect(transaction.communityPost.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { reactionCount: { decrement: 1 } },
      }),
    );
  });

  it('does not change the denormalized count for duplicate adds or missing removes', async () => {
    const transaction = {
      communityPost: {
        findFirst: jest.fn(async (_input: unknown) => ({ id: 'post-1' })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
      },
      communityReaction: {
        createMany: jest.fn(async (_input: unknown) => ({ count: 0 })),
        deleteMany: jest.fn(async (_input: unknown) => ({ count: 0 })),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await service.addReaction('user-2', 'post-1');
    await service.removeReaction('user-2', 'post-1');

    expect(transaction.communityPost.updateMany).not.toHaveBeenCalled();
  });
});
