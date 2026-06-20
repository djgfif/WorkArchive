import * as dns from 'node:dns/promises';
import { isIP } from 'node:net';

export type PublicAddressResolutionFailureCode =
  | 'dns_lookup_failed'
  | 'private_address';

export class PublicAddressResolutionError extends Error {
  constructor(
    message: string,
    readonly code: PublicAddressResolutionFailureCode,
  ) {
    super(message);
    this.name = 'PublicAddressResolutionError';
  }
}

export interface ResolvedPublicNetworkAddress {
  address: string;
  family: 4 | 6;
  hostname: string;
}

export async function resolvePublicNetworkAddress(
  hostname: string,
): Promise<ResolvedPublicNetworkAddress> {
  const normalizedHostname = normalizeNetworkHostname(hostname);
  const literalIpVersion = isIP(normalizedHostname);

  if (literalIpVersion !== 0) {
    return assertPublicAddress(
      normalizedHostname,
      literalIpVersion === 6 ? 6 : 4,
      normalizedHostname,
    );
  }

  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = await dns.lookup(normalizedHostname, {
      all: true,
    });
  } catch {
    throw new PublicAddressResolutionError(
      'Hostname could not be resolved.',
      'dns_lookup_failed',
    );
  }

  const normalizedAddresses = addresses
    .map(({ address, family }) => ({
      address,
      family: family === 6 ? 6 : family === 4 ? 4 : null,
    }))
    .filter(
      (
        item,
      ): item is {
        address: string;
        family: 4 | 6;
      } => item.family !== null,
    );

  if (normalizedAddresses.length === 0) {
    throw new PublicAddressResolutionError(
      'Hostname resolved without usable addresses.',
      'dns_lookup_failed',
    );
  }

  const firstPrivateAddress = normalizedAddresses.find(
    ({ address, family }) => !isPublicIpAddress(address, family),
  );

  if (firstPrivateAddress) {
    throw new PublicAddressResolutionError(
      'Hostname resolved to a private address.',
      'private_address',
    );
  }

  return {
    address: normalizedAddresses[0]!.address,
    family: normalizedAddresses[0]!.family,
    hostname: normalizedHostname,
  };
}

export function normalizeNetworkHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();

  return normalizedHostname.startsWith('[') && normalizedHostname.endsWith(']')
    ? normalizedHostname.slice(1, -1)
    : normalizedHostname;
}

export function isPublicIpAddress(address: string, family: 4 | 6) {
  if (family === 4) {
    return isPublicIpv4Address(address);
  }

  return isPublicIpv6Address(address);
}

function assertPublicAddress(address: string, family: 4 | 6, hostname: string) {
  if (!isPublicIpAddress(address, family)) {
    throw new PublicAddressResolutionError(
      'Hostname resolved to a private address.',
      'private_address',
    );
  }

  return {
    address,
    family,
    hostname,
  };
}

function isPublicIpv4Address(address: string) {
  const octets = address.split('.').map((part) => Number(part));

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second, third] = octets as [number, number, number, number];

  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function isPublicIpv6Address(address: string) {
  const normalizedAddress = address.toLowerCase();
  const mappedIpv4 = readIpv4MappedIpv6Address(normalizedAddress);

  if (mappedIpv4) {
    return isPublicIpv4Address(mappedIpv4);
  }

  const expanded = expandIpv6Address(normalizedAddress);

  if (!expanded) {
    return false;
  }

  return !(
    isAllZeroIpv6(expanded) ||
    matchesIpv6Prefix(expanded, ['0000', '0000', '0000', '0000'], 96) ||
    matchesIpv6Prefix(expanded, ['0064', 'ff9b'], 96) ||
    matchesIpv6Prefix(expanded, ['0064', 'ff9b', '0001'], 48) ||
    matchesIpv6Prefix(expanded, ['0100'], 64) ||
    matchesIpv6Prefix(expanded, ['2001'], 32) ||
    matchesIpv6Prefix(expanded, ['2001', '0002'], 48) ||
    matchesIpv6Prefix(expanded, ['2001', '000d', 'b800'], 48) ||
    matchesIpv6Prefix(expanded, ['2001', '0010'], 28) ||
    matchesIpv6Prefix(expanded, ['2001', '0020'], 28) ||
    matchesIpv6Prefix(expanded, ['2001', '0db8'], 32) ||
    matchesIpv6Prefix(expanded, ['2002'], 16) ||
    matchesIpv6Prefix(expanded, ['fc00'], 7) ||
    matchesIpv6Prefix(expanded, ['fe80'], 10) ||
    matchesIpv6Prefix(expanded, ['ff00'], 8)
  );
}

function readIpv4MappedIpv6Address(address: string) {
  const marker = '::ffff:';

  if (!address.startsWith(marker)) {
    return null;
  }

  const mappedAddress = address.slice(marker.length);

  return isIP(mappedAddress) === 4 ? mappedAddress : null;
}

function expandIpv6Address(address: string) {
  if (!address.includes(':') || address.includes('.')) {
    return null;
  }

  const doubleColonParts = address.split('::');

  if (doubleColonParts.length > 2) {
    return null;
  }

  const left = doubleColonParts[0]
    ? doubleColonParts[0].split(':').filter(Boolean)
    : [];
  const right = doubleColonParts[1]
    ? doubleColonParts[1].split(':').filter(Boolean)
    : [];
  const missingGroups = 8 - left.length - right.length;

  if (missingGroups < 0 || (doubleColonParts.length === 1 && missingGroups !== 0)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: missingGroups }, () => '0'),
    ...right,
  ];

  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))
  ) {
    return null;
  }

  return groups.map((group) => group.padStart(4, '0'));
}

function isAllZeroIpv6(expanded: string[]) {
  return expanded.every((group) => group === '0000');
}

function matchesIpv6Prefix(
  expandedAddress: string[],
  prefixGroups: string[],
  prefixLength: number,
) {
  let remainingPrefixBits = prefixLength;

  for (let index = 0; remainingPrefixBits > 0; index += 1) {
    const addressGroup = Number.parseInt(expandedAddress[index] ?? '0', 16);
    const prefixGroup = Number.parseInt(prefixGroups[index] ?? '0', 16);
    const bitsInGroup = Math.min(remainingPrefixBits, 16);
    const mask = (0xffff << (16 - bitsInGroup)) & 0xffff;

    if ((addressGroup & mask) !== (prefixGroup & mask)) {
      return false;
    }

    remainingPrefixBits -= bitsInGroup;
  }

  return true;
}
