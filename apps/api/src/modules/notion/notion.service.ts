import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkSyncStatus } from '@prisma/client';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    } catch (error) {
      return {
        checkedAt: new Date().toISOString(),
        dataSourceId: connection.dataSourceId,
        message:
          error instanceof Error
            ? error.message
            : 'Notion 연결 테스트에 실패했습니다.',
        ok: false,
        reason: 'provider_unavailable',
      };
    }
  }

  async pushToNotion(userId: string) {
    const connection = await this.getConnectionOrThrow(userId);
    const schema = await this.retrieveDataSourceSchema(connection);
    this.assertUsableSchema(schema);
    const works = await this.prisma.userWorkRecord.findMany({
      where: {
        deletedAt: null,
        userId,
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    let created = 0;
    let updated = 0;
    let skipped = 0;
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
      } catch (error) {
        skipped += 1;
        errors.push({
          message:
            error instanceof Error
              ? error.message
              : 'Notion 페이지 동기화에 실패했습니다.',
          workId: work.id,
        });
      }
    }

    return {
      created,
      errors,
      pushedAt: new Date().toISOString(),
      skipped,
      total: works.length,
      updated,
    };
  }

  async previewPull(userId: string) {
    const { connection, mappings } = await this.getConnectionAndMappings(userId);
    const schema = await this.retrieveDataSourceSchema(connection);
    const previews: NotionChangePreview[] = [];
    const errors: Array<{ message: string; notionPageId: string; workId: string }> =
      [];

    for (const mapping of mappings) {
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

        previews.push({
          changes,
          lastNotionEditedAt: page.last_edited_time ?? null,
          notionPageId: page.id,
          title: getNotionCatalogTitle(work),
          workId: work.id,
        });
      } catch (error) {
        errors.push({
          message:
            error instanceof Error
              ? error.message
              : 'Notion 변경사항 확인에 실패했습니다.',
          notionPageId: mapping.notionPageId,
          workId: mapping.workId,
        });
      }
    }

    return {
      errors,
      previewedAt: new Date().toISOString(),
      changes: previews,
      total: previews.length,
    };
  }

  async applyPull(userId: string, input: { workIds?: string[] }) {
    const preview = await this.previewPull(userId);
    const requestedWorkIds = new Set(input.workIds ?? []);
    const changes = preview.changes.filter(
      (entry) => requestedWorkIds.size === 0 || requestedWorkIds.has(entry.workId),
    );
    let applied = 0;
    const errors: Array<{ message: string; workId: string }> = [];

    for (const entry of changes) {
      const data = buildNotionPullUpdateData(entry.changes);

      try {
        await this.prisma.userWorkRecord.updateMany({
          where: {
            deletedAt: null,
            id: entry.workId,
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
        await this.prisma.notionSyncMapping.updateMany({
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
        applied += 1;
      } catch (error) {
        errors.push({
          message:
            error instanceof Error
              ? error.message
              : 'Notion 변경사항 적용에 실패했습니다.',
          workId: entry.workId,
        });
      }
    }

    return {
      applied,
      errors,
      previewedCount: preview.total,
    };
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

    const response = await fetch(`${NOTION_API_BASE_URL}${input.path}`, init);
    const body = (await response.json().catch(() => ({}))) as unknown;

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

  private assertUsableSchema(schema: NotionDataSourceSchema) {
    if (!isUsableNotionSchema(schema)) {
      throw new BadRequestException(
        'Notion data source must include a title property.',
      );
    }
  }
}
