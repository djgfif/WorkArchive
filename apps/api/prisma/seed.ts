import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured before seeding.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const prisma = createPrismaClient();

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL?.trim() || 'demo@workarchive.local';

const demoWorkSeeds = [
  {
    id: '4cb4ef68-5d7f-432d-8a04-15b951d5b9a4',
    title: "Frieren: Beyond Journey's End",
    author: 'Kanehito Yamada',
    genres: ['Fantasy', 'Drama'],
    type: WorkType.anime,
    status: WorkStatus.completed,
    rating: 5,
    shortReview: 'Quiet, deliberate, and emotionally sharp.',
    favorite: true,
  },
  {
    id: '48fd16f4-51ef-4ca0-ae93-5bfc1d2b7a5a',
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
    type: WorkType.novel,
    status: WorkStatus.completed,
    rating: 4.5,
    shortReview: 'Dense worldbuilding with excellent long-form payoff.',
    favorite: false,
  },
] as const;

async function seed() {
  const demoUser = await prisma.user.upsert({
    where: {
      email: DEMO_EMAIL,
    },
    update: {
      nickname: 'Demo User',
    },
    create: {
      email: DEMO_EMAIL,
      nickname: 'Demo User',
    },
  });

  for (const work of demoWorkSeeds) {
    await prisma.catalogWork.upsert({
      where: {
        id: work.id,
      },
      update: {
        type: work.type,
        title: work.title,
        author: work.author,
        genres: [...work.genres],
        description: '',
        thumbnailUrl: '',
      },
      create: {
        id: work.id,
        type: work.type,
        title: work.title,
        author: work.author,
        genres: [...work.genres],
        description: '',
        thumbnailUrl: '',
      },
    });

    await prisma.catalogTitle.upsert({
      where: {
        id: work.id,
      },
      update: {
        canonicalTitle: work.title,
        displayTitle: work.title,
        mediumType: work.type,
        summary: '',
        thumbnailUrl: '',
      },
      create: {
        id: work.id,
        canonicalTitle: work.title,
        displayTitle: work.title,
        mediumType: work.type,
        summary: '',
        thumbnailUrl: '',
      },
    });

    await prisma.userWorkRecord.upsert({
      where: {
        id: work.id,
      },
      update: {
        userId: demoUser.id,
        catalogWorkId: work.id,
        catalogTitleId: work.id,
        status: work.status,
        rating: work.rating,
        shortReview: work.shortReview,
        review: '',
        favorite: work.favorite,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
        deletedAt: null,
      },
      create: {
        id: work.id,
        userId: demoUser.id,
        catalogWorkId: work.id,
        catalogTitleId: work.id,
        status: work.status,
        rating: work.rating,
        shortReview: work.shortReview,
        review: '',
        favorite: work.favorite,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
      },
    });
  }

  console.log(
    [
      'Seed complete.',
      `Demo email: ${DEMO_EMAIL}`,
      `Demo works: ${demoWorkSeeds.length}`,
    ].join('\n'),
  );
}

void seed()
  .catch((error) => {
    console.error('Seeding failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
