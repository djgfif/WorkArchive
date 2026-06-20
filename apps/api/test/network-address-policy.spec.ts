import { describe, expect, it } from '@jest/globals';

import {
  isPublicIpAddress,
  resolvePublicNetworkAddress,
} from '../src/common/network-address-policy';

describe('network address policy', () => {
  it('allows ordinary public IPv4 and IPv6 addresses', () => {
    expect(isPublicIpAddress('8.8.8.8', 4)).toBe(true);
    expect(isPublicIpAddress('192.0.3.1', 4)).toBe(true);
    expect(isPublicIpAddress('2606:4700:4700::1111', 6)).toBe(true);
  });

  it('blocks private and special-use IPv4 ranges', () => {
    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.0.1',
      '192.0.2.10',
      '198.51.100.10',
      '203.0.113.10',
    ]) {
      expect(isPublicIpAddress(address, 4)).toBe(false);
    }
  });

  it('blocks private and special-use IPv6 ranges', () => {
    for (const address of [
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '64:ff9b::192.0.2.33',
      '100::1',
      '2001:db8::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
    ]) {
      expect(isPublicIpAddress(address, 6)).toBe(false);
    }
  });

  it('resolves public literal IPs without DNS and rejects private literal IPs', async () => {
    await expect(resolvePublicNetworkAddress('8.8.8.8')).resolves.toEqual({
      address: '8.8.8.8',
      family: 4,
      hostname: '8.8.8.8',
    });
    await expect(resolvePublicNetworkAddress('127.0.0.1')).rejects.toMatchObject({
      code: 'private_address',
    });
  });
});
