import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

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

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(PrismaService.name);

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
