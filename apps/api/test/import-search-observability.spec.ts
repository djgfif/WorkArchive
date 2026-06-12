import { WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import {
  collectImportProviderSearchResults,
  getImportSearchResultStatus,
  getImportSearchSummaryStatus,
  logImportProviderFailure,
  logImportSearchSummary,
  recordImportSearchMetric,
} from '../src/modules/imports/import-search-observability';
import type { ImportProviderSearchResult } from '../src/modules/imports/import-search-stage-cache';
import {
  ALADIN_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../src/modules/imports/imports.constants';

const candidate = {
  id: 'candidate-1',
  title: 'Dune',
} as ImportCandidateResponseDto;

describe('import search observability helpers', () => {
  it('collects candidates, failures, and provider diagnostics from search results', () => {
    const results: ImportProviderSearchResult[] = [
      {
        candidates: [candidate],
        diagnostic: {
          configured: true,
          message: 'Open Library search completed.',
          reasonCode: null,
          resultCount: 1,
          status: 'searched',
        },
        failure: null,
        provider: OPEN_LIBRARY_PROVIDER,
      },
      {
        candidates: [],
        diagnostic: {
          configured: true,
          message: 'Aladin Book search is temporarily unavailable.',
          reasonCode: 'provider_failed',
          resultCount: 0,
          status: 'failed',
        },
        failure: 'aladin:BadGatewayException',
        provider: ALADIN_PROVIDER,
      },
    ];

    expect(collectImportProviderSearchResults(results)).toEqual({
      candidates: [candidate],
      diagnostics: {
        providers: [
          expect.objectContaining({
            credentialMode: 'none',
            provider: OPEN_LIBRARY_PROVIDER,
            status: 'searched',
          }),
          expect.objectContaining({
            credentialMode: 'user',
            provider: ALADIN_PROVIDER,
            reasonCode: 'provider_failed',
          }),
        ],
      },
      failures: ['aladin:BadGatewayException'],
    });
  });

  it('derives metric and summary statuses from provider failures', () => {
    expect(getImportSearchResultStatus([])).toBe('ok');
    expect(getImportSearchSummaryStatus([])).toBe('ok');
    expect(getImportSearchResultStatus(['aladin:Error'])).toBe('partial');
    expect(getImportSearchSummaryStatus(['aladin:Error', 'tmdb:Error'])).toBe(
      'partial:aladin:Error|tmdb:Error',
    );
  });

  it('logs provider failures without arbitrary provider payload fields', () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    logImportProviderFailure(logger, {
      durationMs: 12,
      errorCode: 'BadGatewayException',
      provider: ALADIN_PROVIDER,
      userId: 'user-1',
    });

    expect(JSON.parse(String(logger.warn.mock.calls[0]?.[0] ?? ''))).toEqual({
      count: null,
      durationMs: 12,
      entityType: null,
      errorCode: 'BadGatewayException',
      event: 'imports.provider.failed',
      provider: ALADIN_PROVIDER,
      requestId: null,
      userId: 'user-1',
    });
  });

  it('logs search summaries with query length instead of raw query content', () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    logImportSearchSummary(logger, {
      provider: 'open_library,manual',
      query: 'secret search',
      resultCount: 2,
      status: 'ok',
      userId: null,
    });

    expect(logger.log).toHaveBeenCalledWith(
      'Import search summary userId=guest provider=open_library,manual queryLength=13 resultCount=2 status=ok',
    );
  });

  it('records search metric labels and duration', () => {
    const metricsService = {
      recordImportsSearch: jest.fn(),
    };

    recordImportSearchMetric({
      endedAt: 3_500_000_000n,
      mediumType: WorkType.novel,
      metricsService,
      providerCount: 2,
      result: 'partial',
      startedAt: 1_000_000_000n,
      userId: 'user-1',
    });

    expect(metricsService.recordImportsSearch).toHaveBeenCalledWith(
      {
        auth_scope: 'user',
        medium_type: WorkType.novel,
        provider_count: '2',
        result: 'partial',
      },
      2.5,
    );
  });
});
