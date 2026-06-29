import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkSyncStatus, type Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExternalApiKeyCryptoService } from '../imports/credentials/external-api-key-crypto.service';
import { WORK_AGGREGATE_INCLUDE } from '../user-records/user-records.types';
import {
  buildNotionProperties,
  buildNotionPullUpdateData,
  diffNotionSafeValues,
  getNotionCatalogTitle,
  isUsableNotionSchema,
  normalizeNotionDataSourceId,
  NOTION_PROVIDER,
  parseNotionEditedTime,
  PROPERTY_NAMES,
  readSafeValuesFromNotionPage,
  type NotionChangePreview,
  type NotionConnectionPayload,
  type NotionDataSourceSchema,
  type NotionPage,
} from './notion-sync-mappers';

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';
const NOTION_BATCH_LIMIT = 200;
const NOTION_MAX_RESPONSE_BYTES = 1024 * 1024;
const NOTION_MAX_RETRY_DELAY_MS = 1000;
const NOTION_REQUEST_TIMEOUT_MS = 8000;
const NOTION_PREVIEW_SNAPSHOT_TTL_MS = 15 * 60 * 1000;
const NOTION_CONNECTION_TEST_FAILURE_MESSAGE =
  'Notion 연결 테스트에 실패했습니다.';
const NOTION_PAGE_SYNC_FAILURE_MESSAGE =
  'Notion 페이지 동기화에 실패했습니다.';
const NOTION_PREVIEW_FAILURE_MESSAGE =
  'Notion 변경사항 확인에 실패했습니다.';
const NOTION_APPLY_FAILURE_MESSAGE =
  'Notion 변경사항 적용에 실패했습니다.';

interface NotionPullSnapshotEntry extends NotionChangePreview {
  localServerVersion: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRetryableNotionStatus(status: number) {
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  );
}

function readRetryDelayMs(retryAfter: string | null) {
  if (!retryAfter) {
    return NOTION_MAX_RETRY_DELAY_MS;
  }

  const parsedSeconds = Number(retryAfter);

  if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
    return Math.min(parsedSeconds * 1000, NOTION_MAX_RETRY_DELAY_MS);
  }

  return NOTION_MAX_RETRY_DELAY_MS;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSnapshotChanges(value: Prisma.JsonValue): NotionPullSnapshotEntry[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Notion 미리보기 스냅샷이 올바르지 않습니다.');
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.workId !== 'string' ||
      typeof entry.notionPageId !== 'string' ||
      typeof entry.title !== 'string' ||
      typeof entry.localServerVersion !== 'number' ||
      !Array.isArray(entry.changes) ||
      !(
        typeof entry.lastNotionEditedAt === 'string' ||
        entry.lastNotionEditedAt === null
      )
    ) {
      throw new BadRequestException(
        'Notion 미리보기 스냅샷이 올바르지 않습니다.',
      );
    }

    return {
      changes: entry.changes as NotionPullSnapshotEntry['changes'],
      lastNotionEditedAt: entry.lastNotionEditedAt,
      localServerVersion: entry.localServerVersion,
      notionPageId: entry.notionPageId,
      title: entry.title,
      workId: entry.workId,
    };
  });
}

@Injectable()
export class NotionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExternalApiKeyCryptoService)
    private readonly cryptoService: ExternalApiKeyCryptoService,
  ) {}

  async getStatus(userId: string) {
    const [connection, mappedCount, latestMapping] = await Promise.all([
      this.readConnection(userId),
      this.prisma.notionSyncMapping.count({
        where: {
          userId,
        },
      }),
      this.prisma.notionSyncMapping.findFirst({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    return {
      configured: connection !== null,
      dataSourceId: connection?.dataSourceId ?? null,
      lastSyncedAt:
        latestMapping?.lastPushedAt?.toISOString() ??
        latestMapping?.lastPulledAt?.toISOString() ??
        null,
      mappedCount,
      requiredProperties: Object.values(PROPERTY_NAMES),
    };
  }

  async saveConnection(userId: string, input: NotionConnectionPayload) {
    const connection = {
      dataSourceId: normalizeNotionDataSourceId(input.dataSourceId),
      token: input.token.trim(),
    };

    if (!connection.token || !connection.dataSourceId) {
      throw new BadRequestException('Notion token and data source ID are required.');
    }

    const schema = await this.retrieveDataSourceSchema(connection);
    this.assertUsableSchema(schema);

    const encrypted = this.cryptoService.encrypt(JSON.stringify(connection));

    await this.prisma.externalApiCredential.upsert({
      where: {
        userId_provider: {
          provider: NOTION_PROVIDER,
          userId,
        },
      },
      create: {
        provider: NOTION_PROVIDER,
        userId,
        ...encrypted,
      },
      update: encrypted,
    });

    return this.getStatus(userId);
  }

  async deleteConnection(userId: string) {
    await this.prisma.$transaction([
      this.prisma.notionSyncMapping.deleteMany({
        where: {
          userId,
        },
      }),
      this.prisma.notionPullPreviewSnapshot.deleteMany({
        where: {
          userId,
        },
      }),
      this.prisma.externalApiCredential.deleteMany({
        where: {
          provider: NOTION_PROVIDER,
          userId,
        },
      }),
    ]);
  }

  async testConnection(userId: string) {
    const connection = await this.getConnectionOrThrow(userId);

    try {
      const schema = await this.retrieveDataSourceSchema(connection);
      this.assertUsableSchema(schema);

      return {
        checkedAt: new Date().toISOString(),
        dataSourceId: connection.dataSourceId,
        message: 'Notion 연결 테스트에 성공했습니다.',
        ok: true,
        reason: null,
      };
    } catch {
      return {
        checkedAt: new Date().toISOString(),
        dataSourceId: connection.dataSourceId,
        message: NOTION_CONNECTION_TEST_FAILURE_MESSAGE,
        ok: false,
        reason: 'provider_unavailable',
      };
    }
  }

  async pushToNotion(userId: string) {
    const connection = await this.getConnectionOrThrow(userId);
    const schema = await this.retrieveDataSourceSchema(connection);
    this.assertUsableSchema(schema);
    const [totalWorks, works] = await Promise.all([
      this.prisma.userWorkRecord.count({
        where: {
          deletedAt: null,
          userId,
        },
      }),
      this.prisma.userWorkRecord.findMany({
        where: {
          deletedAt: null,
          userId,
        },
        include: WORK_AGGREGATE_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: NOTION_BATCH_LIMIT,
      }),
    ]);
    let created = 0;
    let updated = 0;
    let skipped = Math.max(0, totalWorks - works.length);
    const errors: Array<{ message: string; workId: string }> = [];

    for (const work of works) {
      try {
        const existingMapping = await this.prisma.notionSyncMapping.findUnique({
          where: {
            userId_workId: {
              userId,
              workId: work.id,
            },
          },
        });
        const properties = buildNotionProperties(work, schema);
        const now = new Date();
        const page = existingMapping
          ? await this.updatePage(connection, existingMapping.notionPageId, {
              properties,
            })
          : await this.createPage(connection, {
              parent: {
                type: 'data_source_id',
                data_source_id: connection.dataSourceId,
              },
              properties,
            });

        await this.prisma.notionSyncMapping.upsert({
          where: {
            userId_workId: {
              userId,
              workId: work.id,
            },
          },
          create: {
            lastLocalUpdatedAt: work.updatedAt,
            lastNotionEditedAt: parseNotionEditedTime(page),
            lastPushedAt: now,
            notionDataSourceId: connection.dataSourceId,
            notionPageId: page.id,
            userId,
            workId: work.id,
          },
          update: {
            lastLocalUpdatedAt: work.updatedAt,
            lastNotionEditedAt: parseNotionEditedTime(page),
            lastPushedAt: now,
            notionDataSourceId: connection.dataSourceId,
            notionPageId: page.id,
          },
        });

        if (existingMapping) {
          updated += 1;
        } else {
          created += 1;
        }
      } catch {
        skipped += 1;
        errors.push({
          message: NOTION_PAGE_SYNC_FAILURE_MESSAGE,
          workId: work.id,
        });
      }
    }

    return {
      created,
      errors,
      pushedAt: new Date().toISOString(),
      skipped,
      total: totalWorks,
      updated,
    };
  }

  async previewPull(userId: string) {
    const { connection, mappings } = await this.getConnectionAndMappings(userId);
    const schema = await this.retrieveDataSourceSchema(connection);
    const previews: NotionChangePreview[] = [];
    const snapshotChanges: NotionPullSnapshotEntry[] = [];
    const errors: Array<{ message: string; notionPageId: string; workId: string }> =
      [];

    for (const mapping of mappings.slice(0, NOTION_BATCH_LIMIT)) {
      try {
        const [page, work] = await Promise.all([
          this.retrievePage(connection, mapping.notionPageId),
          this.prisma.userWorkRecord.findFirst({
            where: {
              deletedAt: null,
              id: mapping.workId,
              userId,
            },
            include: WORK_AGGREGATE_INCLUDE,
          }),
        ]);

        if (!work) {
          continue;
        }

        const notionValues = readSafeValuesFromNotionPage(page, schema);
        const changes = diffNotionSafeValues(work, notionValues);

        if (changes.length === 0) {
          continue;
        }

        const preview = {
          changes,
          lastNotionEditedAt: page.last_edited_time ?? null,
          notionPageId: page.id,
          title: getNotionCatalogTitle(work),
          workId: work.id,
        };

        previews.push(preview);
        snapshotChanges.push({
          ...preview,
          localServerVersion: work.serverVersion,
        });
      } catch {
        errors.push({
          message: NOTION_PREVIEW_FAILURE_MESSAGE,
          notionPageId: mapping.notionPageId,
          workId: mapping.workId,
        });
      }
    }

    await this.deleteExpiredPreviewSnapshots(userId);
    const previewedAt = new Date();
    const snapshot = await this.prisma.notionPullPreviewSnapshot.create({
      data: {
        changes: snapshotChanges as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(
          previewedAt.getTime() + NOTION_PREVIEW_SNAPSHOT_TTL_MS,
        ),
        notionDataSourceId: connection.dataSourceId,
        previewedAt,
        userId,
      },
    });

    return {
      errors,
      previewId: snapshot.id,
      previewedAt: previewedAt.toISOString(),
      total: previews.length,
      changes: previews,
    };
  }

  async applyPull(
    userId: string,
    input: { previewId?: string; workIds?: string[] },
  ) {
    const snapshot = await this.getPreviewSnapshotOrThrow(userId, input.previewId);
    const requestedWorkIds = new Set(input.workIds ?? []);
    const warnings = [
      ...this.getUnpreviewedRequestedWorkWarnings(
        requestedWorkIds,
        snapshot.changes,
      ),
      ...(await this.getUnknownRequestedWorkWarnings(
        userId,
        requestedWorkIds,
      )),
    ];
    const changes = snapshot.changes.filter(
      (entry) => requestedWorkIds.size === 0 || requestedWorkIds.has(entry.workId),
    );
    let applied = 0;
    const errors: Array<{ message: string; workId: string }> = [];

    for (const entry of changes) {
      const data = buildNotionPullUpdateData(entry.changes);

      try {
        const didApply = await this.prisma.$transaction(async (client) => {
          const updateResult = await client.userWorkRecord.updateMany({
            where: {
              deletedAt: null,
              id: entry.workId,
              serverVersion: entry.localServerVersion,
              userId,
            },
            data: {
              ...data,
              serverVersion: {
                increment: 1,
              },
              syncStatus: WorkSyncStatus.synced,
            },
          });

          if (updateResult.count === 0) {
            return false;
          }

          await client.notionSyncMapping.updateMany({
            where: {
              notionPageId: entry.notionPageId,
              userId,
            },
            data: {
              lastNotionEditedAt: entry.lastNotionEditedAt
                ? new Date(entry.lastNotionEditedAt)
                : null,
              lastPulledAt: new Date(),
            },
          });

          return true;
        });

        if (!didApply) {
          errors.push({
            message:
              '로컬 작품이 미리보기 이후 변경되어 Notion 변경사항을 적용하지 않았습니다.',
            workId: entry.workId,
          });
          continue;
        }

        applied += 1;
      } catch {
        errors.push({
          message: NOTION_APPLY_FAILURE_MESSAGE,
          workId: entry.workId,
        });
      }
    }

    return {
      applied,
      errors,
      ignoredWorkIds: warnings
        .filter((warning) => warning.code === 'not_previewed')
        .map((warning) => warning.workId),
      notFoundWorkIds: warnings
        .filter((warning) => warning.code === 'not_found')
        .map((warning) => warning.workId),
      previewedCount: snapshot.changes.length,
      warnings,
    };
  }

  private async getPreviewSnapshotOrThrow(
    userId: string,
    previewId: string | undefined,
  ) {
    await this.deleteExpiredPreviewSnapshots(userId);
    const now = new Date();
    const snapshot = previewId
      ? await this.prisma.notionPullPreviewSnapshot.findFirst({
          where: {
            expiresAt: {
              gt: now,
            },
            id: previewId,
            userId,
          },
        })
      : await this.prisma.notionPullPreviewSnapshot.findFirst({
          where: {
            expiresAt: {
              gt: now,
            },
            userId,
          },
          orderBy: {
            previewedAt: 'desc',
          },
        });

    if (!snapshot) {
      throw new BadRequestException(
        'Notion 변경사항을 적용하려면 먼저 미리보기를 다시 생성하세요.',
      );
    }

    return {
      ...snapshot,
      changes: readSnapshotChanges(snapshot.changes),
    };
  }

  private deleteExpiredPreviewSnapshots(userId: string) {
    return this.prisma.notionPullPreviewSnapshot.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
        userId,
      },
    });
  }

  private async getConnectionAndMappings(userId: string) {
    const connection = await this.getConnectionOrThrow(userId);
    const mappings = await this.prisma.notionSyncMapping.findMany({
      where: {
        notionDataSourceId: connection.dataSourceId,
        userId,
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    return { connection, mappings };
  }

  private async getConnectionOrThrow(userId: string) {
    const connection = await this.readConnection(userId);

    if (!connection) {
      throw new NotFoundException('Notion connection is not configured.');
    }

    return connection;
  }

  private async readConnection(userId: string) {
    const credential = await this.prisma.externalApiCredential.findUnique({
      where: {
        userId_provider: {
          provider: NOTION_PROVIDER,
          userId,
        },
      },
      select: {
        authTag: true,
        encryptedKey: true,
        iv: true,
      },
    });

    if (!credential) {
      return null;
    }

    try {
      const parsed = JSON.parse(this.cryptoService.decrypt(credential));

      if (
        isRecord(parsed) &&
        typeof parsed.token === 'string' &&
        typeof parsed.dataSourceId === 'string'
      ) {
        return {
          dataSourceId: normalizeNotionDataSourceId(parsed.dataSourceId),
          token: parsed.token.trim(),
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private async retrieveDataSourceSchema(connection: NotionConnectionPayload) {
    const response = await this.requestNotion(connection, {
      method: 'GET',
      path: `/data_sources/${encodeURIComponent(connection.dataSourceId)}`,
    });

    return isRecord(response.properties)
      ? (response.properties as NotionDataSourceSchema)
      : {};
  }

  private async retrievePage(
    connection: NotionConnectionPayload,
    pageId: string,
  ) {
    const response = await this.requestNotion(connection, {
      method: 'GET',
      path: `/pages/${encodeURIComponent(pageId)}`,
    });

    if (typeof response.id !== 'string') {
      throw new BadGatewayException('Notion returned an invalid page response.');
    }

    return response as NotionPage;
  }

  private createPage(
    connection: NotionConnectionPayload,
    body: Record<string, unknown>,
  ) {
    return this.writePage(connection, '/pages', 'POST', body);
  }

  private updatePage(
    connection: NotionConnectionPayload,
    pageId: string,
    body: Record<string, unknown>,
  ) {
    return this.writePage(
      connection,
      `/pages/${encodeURIComponent(pageId)}`,
      'PATCH',
      body,
    );
  }

  private async writePage(
    connection: NotionConnectionPayload,
    path: string,
    method: 'PATCH' | 'POST',
    body: Record<string, unknown>,
  ) {
    const response = await this.requestNotion(connection, {
      body,
      method,
      path,
    });

    if (typeof response.id !== 'string') {
      throw new BadGatewayException('Notion returned an invalid page response.');
    }

    return response as NotionPage;
  }

  private async requestNotion(
    connection: NotionConnectionPayload,
    input: {
      body?: Record<string, unknown>;
      method: 'GET' | 'PATCH' | 'POST';
      path: string;
    },
  ) {
    const init: RequestInit = {
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      method: input.method,
    };

    if (input.body) {
      init.body = JSON.stringify(input.body);
    }

    const maxAttempts = input.method === 'POST' ? 1 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await this.fetchNotionWithTimeout(
        `${NOTION_API_BASE_URL}${input.path}`,
        init,
      );
      const body = await this.readBoundedJson(response);

      if (
        !response.ok &&
        attempt < maxAttempts &&
        isRetryableNotionStatus(response.status)
      ) {
        await delay(readRetryDelayMs(response.headers.get('retry-after')));
        continue;
      }

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        const message = isRecord(body) && typeof body.message === 'string'
          ? body.message
          : `Notion request failed with status ${response.status}.`;

        if (response.status === 401 || response.status === 403) {
          throw new BadRequestException(
            'Notion token or data source permissions were rejected.',
          );
        }

        if (response.status === 404) {
          throw new NotFoundException(
            'Notion data source or page was not found. Share the source with the integration.',
          );
        }

        if (response.status === 429 || response.status === 529) {
          throw new BadGatewayException(
            retryAfter
              ? `Notion rate limit reached. Retry after ${retryAfter} seconds.`
              : 'Notion rate limit reached. Try again later.',
          );
        }

        throw new BadGatewayException(message);
      }

      return isRecord(body) ? body : {};
    }

    throw new BadGatewayException('Notion request failed.');
  }

  private async fetchNotionWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      NOTION_REQUEST_TIMEOUT_MS,
    );

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BadGatewayException('Notion request timed out.');
      }

      throw new BadGatewayException('Notion request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBoundedJson(response: Response) {
    const contentLength = response.headers.get('content-length');
    const parsedContentLength = contentLength ? Number(contentLength) : null;

    if (
      parsedContentLength !== null &&
      Number.isFinite(parsedContentLength) &&
      parsedContentLength > NOTION_MAX_RESPONSE_BYTES
    ) {
      throw new BadGatewayException('Notion response is too large.');
    }

    if (!response.body) {
      return {};
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalBytes += value.byteLength;

        if (totalBytes > NOTION_MAX_RESPONSE_BYTES) {
          throw new BadGatewayException('Notion response is too large.');
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    if (totalBytes === 0) {
      return {};
    }

    const body = Buffer.concat(chunks, totalBytes).toString('utf8');

    try {
      return JSON.parse(body) as unknown;
    } catch {
      return {};
    }
  }

  private async getUnknownRequestedWorkWarnings(
    userId: string,
    requestedWorkIds: Set<string>,
  ) {
    if (requestedWorkIds.size === 0) {
      return [];
    }

    const knownWorks = await this.prisma.userWorkRecord.findMany({
      where: {
        id: {
          in: [...requestedWorkIds],
        },
        userId,
      },
      select: {
        id: true,
      },
    });
    const knownWorkIds = new Set(knownWorks.map((work) => work.id));

    return [...requestedWorkIds]
      .filter((workId) => !knownWorkIds.has(workId))
      .map((workId) => ({
        code: 'not_found' as const,
        message: '요청한 작품 ID를 찾을 수 없어 적용하지 않았습니다.',
        workId,
      }));
  }

  private getUnpreviewedRequestedWorkWarnings(
    requestedWorkIds: Set<string>,
    changes: NotionPullSnapshotEntry[],
  ) {
    if (requestedWorkIds.size === 0) {
      return [];
    }

    const previewedWorkIds = new Set(changes.map((entry) => entry.workId));

    return [...requestedWorkIds]
      .filter((workId) => !previewedWorkIds.has(workId))
      .map((workId) => ({
        code: 'not_previewed' as const,
        message: '요청한 작품 ID가 미리보기 스냅샷에 없어 적용하지 않았습니다.',
        workId,
      }));
  }

  private assertUsableSchema(schema: NotionDataSourceSchema) {
    if (!isUsableNotionSchema(schema)) {
      throw new BadRequestException(
        'Notion data source must include a title property.',
      );
    }
  }
}
