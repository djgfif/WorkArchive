import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProgressUnit,
  WorkStatus,
  WorkSyncStatus,
  type Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExternalApiKeyCryptoService } from '../imports/credentials/external-api-key-crypto.service';
import { normalizePersonalTags, normalizeString } from '../works/work-aggregate';
import {
  WORK_AGGREGATE_INCLUDE,
  type WorkAggregate,
} from '../user-records/user-records.types';

const NOTION_PROVIDER = 'notion';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';
const MAX_RICH_TEXT_CONTENT_LENGTH = 1900;

const PROPERTY_NAMES = {
  completedAt: 'Completed At',
  droppedAt: 'Dropped At',
  favorite: 'Favorite',
  lastLocalUpdatedAt: 'Last Local Updated At',
  progressCurrent: 'Progress Current',
  progressTotal: 'Progress Total',
  progressUnit: 'Progress Unit',
  rating: 'Rating',
  review: 'Review',
  shortReview: 'Short Review',
  startedAt: 'Started At',
  status: 'Status',
  tags: 'Tags',
  title: 'Title',
  type: 'Type',
  workArchiveId: 'Work Archive ID',
} as const;

const STATUS_TO_NOTION_LABEL: Record<WorkStatus, string> = {
  [WorkStatus.planned]: '예정',
  [WorkStatus.in_progress]: '진행 중',
  [WorkStatus.on_hold]: '보류',
  [WorkStatus.completed]: '완료',
  [WorkStatus.dropped]: '중단',
};

const NOTION_STATUS_TO_WORK_STATUS = new Map<string, WorkStatus>([
  ['planned', WorkStatus.planned],
  ['예정', WorkStatus.planned],
  ['in_progress', WorkStatus.in_progress],
  ['진행 중', WorkStatus.in_progress],
  ['진행중', WorkStatus.in_progress],
  ['on_hold', WorkStatus.on_hold],
  ['보류', WorkStatus.on_hold],
  ['completed', WorkStatus.completed],
  ['완료', WorkStatus.completed],
  ['dropped', WorkStatus.dropped],
  ['중단', WorkStatus.dropped],
]);

const TYPE_LABELS: Record<string, string> = {
  anime: '애니',
  drama: '드라마',
  light_novel: '라이트노벨',
  manga: '만화',
  movie: '영화',
  novel: '소설',
  other: '기타',
  web_novel: '웹소설',
  webtoon: '웹툰',
};

type NotionConnectionPayload = {
  dataSourceId: string;
  token: string;
};

type NotionPropertyKind =
  | 'checkbox'
  | 'date'
  | 'multi_select'
  | 'number'
  | 'rich_text'
  | 'select'
  | 'status'
  | 'title'
  | string;

type NotionDataSourceSchema = Record<string, { type?: NotionPropertyKind }>;

type NotionPage = {
  id: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
  url?: string;
};

type NotionSafeField =
  | 'completedAt'
  | 'droppedAt'
  | 'favorite'
  | 'personalTags'
  | 'progressCurrent'
  | 'progressTotal'
  | 'progressUnit'
  | 'rating'
  | 'review'
  | 'shortReview'
  | 'startedAt'
  | 'status';

type NotionSafeValues = Partial<{
  completedAt: string | null;
  droppedAt: string | null;
  favorite: boolean;
  personalTags: string[];
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: ProgressUnit | null;
  rating: number | null;
  review: string;
  shortReview: string;
  startedAt: string | null;
  status: WorkStatus;
}>;

export interface NotionChangePreview {
  changes: Array<{
    field: NotionSafeField;
    localValue: unknown;
    notionValue: unknown;
  }>;
  lastNotionEditedAt: string | null;
  notionPageId: string;
  title: string;
  workId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncateNotionText(value: string) {
  return value.slice(0, MAX_RICH_TEXT_CONTENT_LENGTH);
}

function toDateOnly(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function normalizeDataSourceId(value: string) {
  return value.trim().replaceAll('-', '');
}

function getCatalogTitle(work: WorkAggregate) {
  return work.catalogTitle?.displayTitle ?? work.catalogWork.title;
}

function getWorkMediumType(work: WorkAggregate) {
  return work.catalogTitle?.mediumType ?? work.catalogWork.type;
}

function getPropertyType(schema: NotionDataSourceSchema, name: string) {
  return schema[name]?.type ?? null;
}

function hasProperty(schema: NotionDataSourceSchema, name: string) {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

function richTextValue(value: string) {
  const content = truncateNotionText(value.trim());

  return content ? [{ text: { content } }] : [];
}

function dateProperty(value: Date | null | undefined) {
  return value
    ? {
        start: value.toISOString().slice(0, 10),
      }
    : null;
}

function dateTimeProperty(value: Date | null | undefined) {
  return value
    ? {
        start: value.toISOString(),
      }
    : null;
}

function readRichTextProperty(property: unknown) {
  if (!isRecord(property)) {
    return null;
  }

  const values =
    Array.isArray(property.rich_text)
      ? property.rich_text
      : Array.isArray(property.title)
        ? property.title
        : null;

  if (!values) {
    return null;
  }

  return values
    .map((entry) =>
      isRecord(entry) && typeof entry.plain_text === 'string'
        ? entry.plain_text
        : '',
    )
    .join('')
    .trim();
}

function readSelectName(property: unknown) {
  if (!isRecord(property)) {
    return null;
  }

  const select = isRecord(property.select)
    ? property.select
    : isRecord(property.status)
      ? property.status
      : null;

  return typeof select?.name === 'string' ? select.name.trim() : null;
}

function readCheckbox(property: unknown) {
  return isRecord(property) && typeof property.checkbox === 'boolean'
    ? property.checkbox
    : null;
}

function readNumber(property: unknown) {
  return isRecord(property) && typeof property.number === 'number'
    ? property.number
    : null;
}

function readRating(property: unknown) {
  const rating = readNumber(property);

  if (rating === null) {
    return null;
  }

  return rating >= 0 && rating <= 5 ? rating : undefined;
}

function readProgressInteger(property: unknown) {
  const value = readNumber(property);

  if (value === null) {
    return null;
  }

  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readDate(property: unknown) {
  if (!isRecord(property) || !isRecord(property.date)) {
    return null;
  }

  return typeof property.date.start === 'string' ? property.date.start : null;
}

function readMultiSelect(property: unknown) {
  if (!isRecord(property) || !Array.isArray(property.multi_select)) {
    return null;
  }

  return property.multi_select
    .map((entry) =>
      isRecord(entry) && typeof entry.name === 'string' ? entry.name.trim() : '',
    )
    .filter(Boolean);
}

function parseProgressUnit(value: string | null) {
  if (value === ProgressUnit.volume) {
    return ProgressUnit.volume;
  }

  if (value === ProgressUnit.episode || value === '에피소드') {
    return ProgressUnit.episode;
  }

  if (value === ProgressUnit.chapter || value === '화') {
    return ProgressUnit.chapter;
  }

  if (value === '권') {
    return ProgressUnit.volume;
  }

  return null;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
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
      dataSourceId: normalizeDataSourceId(input.dataSourceId),
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
        const properties = this.buildNotionProperties(work, schema);
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
            lastNotionEditedAt: this.parseNotionEditedTime(page),
            lastPushedAt: now,
            notionDataSourceId: connection.dataSourceId,
            notionPageId: page.id,
            userId,
            workId: work.id,
          },
          update: {
            lastLocalUpdatedAt: work.updatedAt,
            lastNotionEditedAt: this.parseNotionEditedTime(page),
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

        const notionValues = this.readSafeValuesFromPage(page, schema);
        const changes = this.diffSafeValues(work, notionValues);

        if (changes.length === 0) {
          continue;
        }

        previews.push({
          changes,
          lastNotionEditedAt: page.last_edited_time ?? null,
          notionPageId: page.id,
          title: getCatalogTitle(work),
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
      const data: Prisma.UserWorkRecordUpdateManyMutationInput = {};

      for (const change of entry.changes) {
        switch (change.field) {
          case 'completedAt':
          case 'droppedAt':
          case 'startedAt':
            data[change.field] = this.parseNullableDate(change.notionValue);
            break;
          case 'favorite':
            data.favorite = Boolean(change.notionValue);
            break;
          case 'personalTags':
            data.personalTags = normalizePersonalTags(
              Array.isArray(change.notionValue) ? change.notionValue : [],
            );
            break;
          case 'progressCurrent':
          case 'progressTotal':
            data[change.field] =
              typeof change.notionValue === 'number' ? change.notionValue : null;
            break;
          case 'progressUnit':
            data.progressUnit =
              typeof change.notionValue === 'string'
                ? parseProgressUnit(change.notionValue)
                : null;
            break;
          case 'rating':
            data.rating =
              typeof change.notionValue === 'number' ? change.notionValue : null;
            break;
          case 'review':
          case 'shortReview':
            data[change.field] =
              typeof change.notionValue === 'string'
                ? normalizeString(change.notionValue)
                : '';
            break;
          case 'status':
            if (typeof change.notionValue === 'string') {
              const status = NOTION_STATUS_TO_WORK_STATUS.get(change.notionValue);

              if (status) {
                data.status = status;
              }
            }
            break;
        }
      }

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
          dataSourceId: normalizeDataSourceId(parsed.dataSourceId),
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
    const hasTitle = Object.values(schema).some((property) => {
      return property?.type === 'title';
    });

    if (!hasTitle) {
      throw new BadRequestException(
        'Notion data source must include a title property.',
      );
    }
  }

  private buildNotionProperties(
    work: WorkAggregate,
    schema: NotionDataSourceSchema,
  ) {
    const properties: Record<string, unknown> = {};
    const titlePropertyName =
      this.findTitlePropertyName(schema) ?? PROPERTY_NAMES.title;
    properties[titlePropertyName] = {
      title: richTextValue(getCatalogTitle(work)),
    };

    this.setProperty(properties, schema, PROPERTY_NAMES.workArchiveId, {
      rich_text: richTextValue(work.id),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.type, {
      select: {
        name: TYPE_LABELS[getWorkMediumType(work)] ?? getWorkMediumType(work),
      },
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.status, {
      [this.getStatusPropertyKind(schema)]: {
        name: STATUS_TO_NOTION_LABEL[work.status],
      },
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.rating, {
      number: work.rating,
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.favorite, {
      checkbox: work.favorite,
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.tags, {
      multi_select: work.personalTags.map((name) => ({ name })),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.shortReview, {
      rich_text: richTextValue(work.shortReview),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.review, {
      rich_text: richTextValue(work.review),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.progressCurrent, {
      number: work.progressCurrent,
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.progressTotal, {
      number: work.progressTotal,
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.progressUnit, {
      select: work.progressUnit ? { name: work.progressUnit } : null,
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.startedAt, {
      date: dateProperty(work.startedAt),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.completedAt, {
      date: dateProperty(work.completedAt),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.droppedAt, {
      date: dateProperty(work.droppedAt),
    });
    this.setProperty(properties, schema, PROPERTY_NAMES.lastLocalUpdatedAt, {
      date: dateTimeProperty(work.updatedAt),
    });

    return properties;
  }

  private setProperty(
    output: Record<string, unknown>,
    schema: NotionDataSourceSchema,
    name: string,
    value: unknown,
  ) {
    if (hasProperty(schema, name)) {
      output[name] = value;
    }
  }

  private findTitlePropertyName(schema: NotionDataSourceSchema) {
    return Object.entries(schema).find(([, property]) => {
      return property?.type === 'title';
    })?.[0];
  }

  private getStatusPropertyKind(schema: NotionDataSourceSchema) {
    return getPropertyType(schema, PROPERTY_NAMES.status) === 'status'
      ? 'status'
      : 'select';
  }

  private readSafeValuesFromPage(
    page: NotionPage,
    schema: NotionDataSourceSchema,
  ): NotionSafeValues {
    const properties = page.properties ?? {};
    const statusName = readSelectName(properties[PROPERTY_NAMES.status]);
    const progressUnitName = readSelectName(
      properties[PROPERTY_NAMES.progressUnit],
    );
    const values: NotionSafeValues = {};

    if (hasProperty(schema, PROPERTY_NAMES.status) && statusName) {
      const status = NOTION_STATUS_TO_WORK_STATUS.get(statusName);

      if (status) {
        values.status = status;
      }
    }

    if (hasProperty(schema, PROPERTY_NAMES.rating)) {
      const rating = readRating(properties[PROPERTY_NAMES.rating]);

      if (rating !== undefined) {
        values.rating = rating;
      }
    }

    if (hasProperty(schema, PROPERTY_NAMES.favorite)) {
      values.favorite = readCheckbox(properties[PROPERTY_NAMES.favorite]) ?? false;
    }

    if (hasProperty(schema, PROPERTY_NAMES.tags)) {
      values.personalTags = readMultiSelect(properties[PROPERTY_NAMES.tags]) ?? [];
    }

    if (hasProperty(schema, PROPERTY_NAMES.shortReview)) {
      values.shortReview =
        readRichTextProperty(properties[PROPERTY_NAMES.shortReview]) ?? '';
    }

    if (hasProperty(schema, PROPERTY_NAMES.review)) {
      values.review = readRichTextProperty(properties[PROPERTY_NAMES.review]) ?? '';
    }

    if (hasProperty(schema, PROPERTY_NAMES.progressCurrent)) {
      const progressCurrent = readProgressInteger(
        properties[PROPERTY_NAMES.progressCurrent],
      );

      if (progressCurrent !== undefined) {
        values.progressCurrent = progressCurrent;
      }
    }

    if (hasProperty(schema, PROPERTY_NAMES.progressTotal)) {
      const progressTotal = readProgressInteger(
        properties[PROPERTY_NAMES.progressTotal],
      );

      if (progressTotal !== undefined) {
        values.progressTotal = progressTotal;
      }
    }

    if (hasProperty(schema, PROPERTY_NAMES.progressUnit)) {
      values.progressUnit = parseProgressUnit(progressUnitName);
    }

    if (hasProperty(schema, PROPERTY_NAMES.startedAt)) {
      values.startedAt = readDate(properties[PROPERTY_NAMES.startedAt]);
    }

    if (hasProperty(schema, PROPERTY_NAMES.completedAt)) {
      values.completedAt = readDate(properties[PROPERTY_NAMES.completedAt]);
    }

    if (hasProperty(schema, PROPERTY_NAMES.droppedAt)) {
      values.droppedAt = readDate(properties[PROPERTY_NAMES.droppedAt]);
    }

    return values;
  }

  private diffSafeValues(work: WorkAggregate, notionValues: NotionSafeValues) {
    const localValues: NotionSafeValues = {
      completedAt: toDateOnly(work.completedAt),
      droppedAt: toDateOnly(work.droppedAt),
      favorite: work.favorite,
      personalTags: work.personalTags,
      progressCurrent: work.progressCurrent,
      progressTotal: work.progressTotal,
      progressUnit: work.progressUnit,
      rating: work.rating,
      review: work.review,
      shortReview: work.shortReview,
      startedAt: toDateOnly(work.startedAt),
      status: work.status,
    };
    const changes: NotionChangePreview['changes'] = [];

    for (const [field, notionValue] of Object.entries(notionValues) as Array<
      [NotionSafeField, unknown]
    >) {
      const localValue = localValues[field];

      if (!valuesEqual(localValue, notionValue)) {
        changes.push({ field, localValue, notionValue });
      }
    }

    return changes;
  }

  private parseNotionEditedTime(page: NotionPage) {
    return page.last_edited_time ? new Date(page.last_edited_time) : null;
  }

  private parseNullableDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }
}
