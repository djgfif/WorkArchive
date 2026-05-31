import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../../prisma/prisma.service';

export type SyncPushClient = Prisma.TransactionClient | PrismaService;
