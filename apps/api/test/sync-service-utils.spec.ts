import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import {
  assertSupportedSyncSchemaVersion,
  describeError,
  logStructuredSyncEvent,
  parseIsoDate,
} from '../src/modules/sync/services/sync-service-utils';
import { SYNC_SCHEMA_VERSION } from '../src/modules/sync/sync.constants';

describe('sync service utils', () => {
  it('accepts omitted and current schema versions', () => {
    expect(() => assertSupportedSyncSchemaVersion({})).not.toThrow();
    expect(() =>
      assertSupportedSyncSchemaVersion({ schemaVersion: SYNC_SCHEMA_VERSION }),
    ).not.toThrow();
  });

  it('rejects unsupported schema versions with the existing message shape', () => {
    expect(() =>
      assertSupportedSyncSchemaVersion({ schemaVersion: 999 }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSupportedSyncSchemaVersion({ schemaVersion: 999 }),
    ).toThrow(
      `Unsupported sync schema version "999". Supported version is ${SYNC_SCHEMA_VERSION}.`,
    );
  });

  it('parses ISO dates and rejects invalid date values', () => {
    expect(parseIsoDate('2026-04-18T00:00:00.000Z', 'since')).toEqual(
      new Date('2026-04-18T00:00:00.000Z'),
    );

    expect(() => parseIsoDate('not-a-date', 'since')).toThrow(
      'since must be a valid ISO 8601 date string.',
    );
  });

  it('describes errors without leaking arbitrary values', () => {
    expect(describeError(new TypeError('private detail'))).toBe('TypeError');
    expect(describeError('private detail')).toBe('UnknownError');
  });

  it('logs structured sync events with null defaults', () => {
    const logger = {
      log: jest.fn(),
    };

    logStructuredSyncEvent(logger, 'sync.test', {
      entityType: 'work',
      requestId: 'request-1',
    });

    expect(logger.log).toHaveBeenCalledWith(
      JSON.stringify({
        count: null,
        durationMs: null,
        entityType: 'work',
        errorCode: null,
        event: 'sync.test',
        provider: null,
        requestId: 'request-1',
        userId: null,
      }),
    );
  });
});
