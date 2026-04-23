import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { ImportsCredentialService } from './imports-credential.service';
import {
  ALADIN_PROVIDER,
  type ImportProvider,
} from './imports.constants';

const ALADIN_ITEM_SEARCH_URL =
  'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
const ALADIN_ATTRIBUTION =
  '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

type UnknownRecord = Record<string, unknown>;

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @Inject(ImportsCredentialService)
    private readonly credentialService: ImportsCredentialService,
  ) {}

  async getAladinProviderStatus(
    userId: string,
  ): Promise<ImportProviderStatusResponseDto> {
    return {
      provider: ALADIN_PROVIDER,
      configured: await this.credentialService.hasCredential(
        userId,
        ALADIN_PROVIDER,
      ),
    };
  }

  async saveAladinKey(
    userId: string,
    ttbKey: string,
  ): Promise<ImportProviderStatusResponseDto> {
    await this.credentialService.saveCredential(userId, ALADIN_PROVIDER, ttbKey);

    return {
      provider: ALADIN_PROVIDER,
      configured: true,
    };
  }

  async deleteAladinKey(userId: string) {
    await this.credentialService.deleteCredential(userId, ALADIN_PROVIDER);
  }

  async search(
    userId: string,
    searchQuery: ImportSearchQueryDto,
  ): Promise<ImportSearchResponseDto> {
    const provider = searchQuery.provider ?? ALADIN_PROVIDER;
    const query = searchQuery.query.trim();
    const limit = this.normalizeLimit(searchQuery.limit);

    if (!query) {
      throw new BadRequestException('query must not be empty');
    }

    if (provider !== ALADIN_PROVIDER) {
      throw new BadRequestException('Unsupported import provider.');
    }

    const ttbKey = await this.credentialService.getDecryptedCredential(
      userId,
      provider,
    );

    if (!ttbKey) {
      this.logSearchSummary(userId, provider, query, 0, 'missing-key');
      throw new ForbiddenException(
        'Aladin API key is not configured for this user.',
      );
    }

    try {
      const candidates = await this.searchAladin(ttbKey, query, limit);

      this.logSearchSummary(userId, provider, query, candidates.length, 'ok');

      return {
        provider,
        query,
        candidates,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      this.logSearchSummary(userId, provider, query, 0, errorName);
      throw error;
    }
  }

  private normalizeLimit(limit: number | undefined) {
    if (limit === undefined) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private async searchAladin(
    ttbKey: string,
    query: string,
    limit: number,
  ): Promise<ImportCandidateResponseDto[]> {
    const searchUrl = new URL(ALADIN_ITEM_SEARCH_URL);

    searchUrl.searchParams.set('ttbkey', ttbKey);
    searchUrl.searchParams.set('Query', query);
    searchUrl.searchParams.set('QueryType', 'Keyword');
    searchUrl.searchParams.set('SearchTarget', 'Book');
    searchUrl.searchParams.set('output', 'JS');
    searchUrl.searchParams.set('Version', '20131101');
    searchUrl.searchParams.set('MaxResults', limit.toString());
    searchUrl.searchParams.set('start', '1');
    searchUrl.searchParams.set('Cover', 'Big');

    let response: Response;

    try {
      response = await fetch(searchUrl, {
        headers: {
          accept: 'application/json',
        },
      });
    } catch {
      throw new BadGatewayException('Aladin search is temporarily unavailable.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new ForbiddenException('Configured Aladin API key was rejected.');
    }

    if (!response.ok) {
      throw new BadGatewayException('Aladin search returned an upstream error.');
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      throw new BadGatewayException('Aladin search returned an unreadable response.');
    }

    return this.mapAladinResponse(responseBody);
  }

  private mapAladinResponse(responseBody: unknown): ImportCandidateResponseDto[] {
    if (!this.isRecord(responseBody)) {
      throw new BadGatewayException('Aladin search returned an invalid response.');
    }

    if (responseBody.errorCode || responseBody.errorMessage) {
      throw new ForbiddenException('Configured Aladin API key was rejected.');
    }

    if (responseBody.item === undefined) {
      return [];
    }

    if (!Array.isArray(responseBody.item)) {
      throw new BadGatewayException('Aladin search returned an invalid item list.');
    }

    return responseBody.item
      .map((item, index) => this.mapAladinItem(item, index))
      .filter((candidate): candidate is ImportCandidateResponseDto => candidate !== null);
  }

  private mapAladinItem(
    item: unknown,
    index: number,
  ): ImportCandidateResponseDto | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const title = this.readString(item.title).trim();

    if (!title) {
      return null;
    }

    const externalId =
      this.readString(item.itemId) ||
      this.readString(item.isbn13) ||
      this.readString(item.isbn) ||
      title;
    const categoryName = this.readString(item.categoryName);
    const publisher = this.readString(item.publisher);
    const publishedAt = this.readString(item.pubDate);
    const type = this.mapWorkType(categoryName);

    return {
      id: `${ALADIN_PROVIDER}:${externalId}`,
      externalId,
      sourceId: ALADIN_PROVIDER,
      sourceLabel: 'Aladin Book',
      title,
      author: this.readString(item.author).trim(),
      type,
      description: this.normalizeWhitespace(this.readString(item.description)),
      thumbnailUrl: this.readString(item.cover).trim(),
      genresText: this.toGenresText(categoryName),
      formatLabel: this.getFormatLabel(type),
      countLabel:
        [publisher, publishedAt].filter(Boolean).join(' · ') ||
        `Aladin ID ${externalId}`,
      confidenceLabel: index === 0 ? '가장 유력' : '후보',
      note: ALADIN_ATTRIBUTION,
      sourceUrl: this.readString(item.link).trim(),
    };
  }

  private mapWorkType(categoryName: string) {
    if (categoryName.includes('라이트노벨') || categoryName.includes('라이트 노벨')) {
      return WorkType.light_novel;
    }

    if (categoryName.includes('소설')) {
      return WorkType.novel;
    }

    return WorkType.other;
  }

  private getFormatLabel(type: WorkType) {
    switch (type) {
      case WorkType.light_novel:
        return '라이트노벨';
      case WorkType.novel:
        return '소설';
      default:
        return '도서';
    }
  }

  private toGenresText(categoryName: string) {
    const parts = categoryName
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
    const meaningfulParts = parts.length > 1 ? parts.slice(1) : parts;

    return meaningfulParts
      .slice(-3)
      .join(', ');
  }

  private normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private readString(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return '';
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private logSearchSummary(
    userId: string,
    provider: ImportProvider,
    query: string,
    resultCount: number,
    status: string,
  ) {
    this.logger.log(
      `Import search summary userId=${userId} provider=${provider} queryLength=${query.length} resultCount=${resultCount} status=${status}`,
    );
  }
}
