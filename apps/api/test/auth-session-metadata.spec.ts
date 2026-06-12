import { describe, expect, it } from '@jest/globals';

import {
  maskAuthSessionIpAddress,
  summarizeAuthSessionUserAgent,
} from '../src/modules/auth/auth-session-metadata';

describe('auth session metadata helpers', () => {
  it('summarizes common browser user agents without storing the raw value', () => {
    expect(
      summarizeAuthSessionUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
    expect(
      summarizeAuthSessionUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      ),
    ).toBe('Firefox on Windows');
    expect(
      summarizeAuthSessionUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
  });

  it('keeps already summarized user agents and null metadata stable', () => {
    expect(summarizeAuthSessionUserAgent('Chrome on macOS')).toBe(
      'Chrome on macOS',
    );
    expect(summarizeAuthSessionUserAgent(null)).toBeNull();
  });

  it('masks IPv4, IPv6, invalid, and null addresses consistently', () => {
    expect(maskAuthSessionIpAddress('203.0.113.42')).toBe('203.0.113.x');
    expect(maskAuthSessionIpAddress('2001:db8:abcd:12::1')).toBe(
      '2001:db8:...',
    );
    expect(maskAuthSessionIpAddress('not-an-ip')).toBe('masked');
    expect(maskAuthSessionIpAddress(null)).toBeNull();
  });
});
