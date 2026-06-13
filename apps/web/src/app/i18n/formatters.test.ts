import { describe, expect, it } from 'vitest';

import {
  formatAppDate,
  formatAppDateTime,
  formatAppNumber,
} from './formatters';

describe('app locale formatters', () => {
  it('uses the supplied app locale for dates, datetimes, and numbers', () => {
    expect(
      formatAppDate('2026-05-12T00:00:00.000Z', { dateStyle: 'medium' }, 'ko'),
    ).toContain('2026');
    expect(
      formatAppDateTime(
        '2026-05-12T09:30:00.000Z',
        { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' },
        'ko',
      ),
    ).toContain('2026');
    expect(formatAppNumber(1234, undefined, 'ko')).toBe('1,234');
  });
});
