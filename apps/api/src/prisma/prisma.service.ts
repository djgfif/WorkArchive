import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_LOCAL_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:18732/work_archive?schema=public';

function readConnectTimeoutMs() {
  const value = process.env.PRISMA_CONNECT_TIMEOUT_MS?.trim();

  if (!value) {
    return DEFAULT_CONNECT_TIMEOUT_MS;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_CONNECT_TIMEOUT_MS;
}

function rejectAfterTimeout(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Timed out connecting to PostgreSQL after ${timeoutMs}ms. Check DATABASE_URL and Docker port forwarding before starting the API.`,
        ),
      );
    }, timeoutMs);

    timeout.unref();
  });
}

function readPrismaDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_URL;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: readPrismaDatabaseUrl(),
      }),
    });
  }

  async onModuleInit() {
    try {
      await Promise.race([
        this.$connect(),
        rejectAfterTimeout(readConnectTimeoutMs()),
      ]);
    } catch (error) {
      this.logger.error(
        'Failed to connect to PostgreSQL. Check DATABASE_URL and ensure the database is reachable before starting the API.',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
