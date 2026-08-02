import { isIP } from 'node:net';

/**
 * Decides whether an address or hostname is safe for the server to fetch.
 *
 * ## Why this exists
 * Any feature that fetches a URL a USER supplied is a server-side request forgery
 * primitive: the attacker picks the address and our server - which sits inside the
 * network, holds a cloud identity and can reach the database - makes the request.
 * The classic payloads are `http://127.0.0.1:5432`, `http://10.0.0.5/admin` and
 * `http://169.254.169.254/latest/meta-data/iam/security-credentials/`, the last of
 * which hands over cloud credentials on most providers.
 *
 * This module is deliberately pure and paranoid: no I/O, no config, deny by
 * default, and every range spelled out rather than inferred. It is the half of
 * the SSRF defence that can be exhaustively unit-tested; `safe-http.util.ts` is
 * the half that has to talk to the network.
 */

/** Why an address was rejected. Surfaced to the operator as one flat message. */
export type BlockedReason =
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'unique-local'
  | 'multicast'
  | 'reserved'
  | 'unspecified'
  | 'cloud-metadata'
  | 'internal-hostname'
  | 'not-an-ip';

/**
 * Hostnames that resolve inside infrastructure rather than on the internet.
 * Checked BEFORE DNS so a suffix match cannot be dodged by a resolver that
 * answers with a public-looking address.
 */
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local', // mDNS
  '.internal', // GCP + common k8s convention
  '.intranet',
  '.private',
  '.corp',
  '.home',
  '.lan',
];

const BLOCKED_HOST_EXACT = new Set([
  'localhost',
  'metadata', // common short form
  'metadata.google.internal',
  'metadata.goog',
  'instance-data', // AWS legacy
]);

/** IPv4 CIDRs that must never be dialled. */
const BLOCKED_V4: Array<[cidr: string, reason: BlockedReason]> = [
  ['0.0.0.0/8', 'unspecified'],
  ['10.0.0.0/8', 'private'],
  ['100.64.0.0/10', 'reserved'], // carrier-grade NAT
  ['127.0.0.0/8', 'loopback'],
  ['169.254.0.0/16', 'link-local'], // includes 169.254.169.254, the metadata endpoint
  ['172.16.0.0/12', 'private'],
  ['192.0.0.0/24', 'reserved'],
  ['192.0.2.0/24', 'reserved'], // TEST-NET-1
  ['192.168.0.0/16', 'private'],
  ['198.18.0.0/15', 'reserved'], // benchmarking
  ['198.51.100.0/24', 'reserved'], // TEST-NET-2
  ['203.0.113.0/24', 'reserved'], // TEST-NET-3
  ['224.0.0.0/4', 'multicast'],
  ['240.0.0.0/4', 'reserved'], // includes 255.255.255.255
];

/** IPv6 prefixes that must never be dialled, as (prefix, bit length, reason). */
const BLOCKED_V6: Array<[prefix: string, bits: number, reason: BlockedReason]> =
  [
    ['::', 128, 'unspecified'],
    ['::1', 128, 'loopback'],
    ['64:ff9b::', 96, 'reserved'], // NAT64 - can wrap a private v4
    ['100::', 64, 'reserved'], // discard-only
    ['2001:db8::', 32, 'reserved'], // documentation
    ['fc00::', 7, 'unique-local'],
    ['fe80::', 10, 'link-local'],
    ['ff00::', 8, 'multicast'],
  ];

/** Dotted-quad → unsigned 32-bit. Returns null when it is not a valid IPv4. */
function v4ToInt(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** Expand any IPv6 form (`::`, mixed, compressed) into 8 numeric groups. */
function v6ToGroups(address: string): number[] | null {
  let text = address;

  // A trailing IPv4 part (`::ffff:192.168.0.1`) becomes two 16-bit groups.
  const v4Tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4Tail) {
    const asInt = v4ToInt(v4Tail[1]);
    if (asInt === null) return null;
    text =
      text.slice(0, v4Tail.index) +
      ((asInt >>> 16) & 0xffff).toString(16) +
      ':' +
      (asInt & 0xffff).toString(16);
  }

  const [head, tail, ...extra] = text.split('::');
  if (extra.length > 0) return null; // more than one '::' is malformed

  const parse = (chunk: string): number[] | null => {
    if (chunk === '') return [];
    const out: number[] = [];
    for (const group of chunk.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const left = parse(head ?? '');
  const right = tail === undefined ? [] : parse(tail);
  if (left === null || right === null) return null;

  if (tail === undefined) return left.length === 8 ? left : null;

  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array<number>(fill).fill(0), ...right];
}

function v4InCidr(value: number, cidr: string): boolean {
  const [base, bitsText] = cidr.split('/');
  const baseInt = v4ToInt(base);
  if (baseInt === null) return false;
  const bits = Number(bitsText);
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) >>> 0 === (baseInt & mask) >>> 0;
}

function v6InPrefix(groups: number[], prefix: string, bits: number): boolean {
  const prefixGroups = v6ToGroups(prefix);
  if (!prefixGroups) return false;
  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const take = Math.min(16, remaining);
    const mask = take === 16 ? 0xffff : (0xffff << (16 - take)) & 0xffff;
    if ((groups[i] & mask) !== (prefixGroups[i] & mask)) return false;
    remaining -= take;
  }
  return true;
}

/**
 * `null` when the address is safe to dial, otherwise why it is not.
 *
 * IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is unwrapped and re-checked as IPv4 -
 * skipping that is a well-known bypass, because the v6 form of a loopback
 * address does not match any v6 blocklist entry.
 */
export function blockedIpReason(address: string): BlockedReason | null {
  const family = isIP(address);
  if (family === 0) return 'not-an-ip';

  if (family === 4) {
    const value = v4ToInt(address);
    if (value === null) return 'not-an-ip';
    for (const [cidr, reason] of BLOCKED_V4) {
      if (v4InCidr(value, cidr)) return reason;
    }
    return null;
  }

  const groups = v6ToGroups(address);
  if (!groups) return 'not-an-ip';

  // ::ffff:0:0/96 - an IPv4 address wearing a v6 costume. Unwrap, do not trust.
  const isV4Mapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (isV4Mapped) {
    const v4 = `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
    return blockedIpReason(v4);
  }

  for (const [prefix, bits, reason] of BLOCKED_V6) {
    if (v6InPrefix(groups, prefix, bits)) return reason;
  }
  return null;
}

/**
 * Hostname check that runs BEFORE resolution. An IP literal is validated
 * immediately; a name is only screened for infrastructure suffixes here, because
 * whether it points somewhere private can only be known after DNS.
 */
export function blockedHostnameReason(hostname: string): BlockedReason | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, ''); // strip the FQDN root dot

  // `[::1]` arrives bracketed from a URL.
  const unbracketed =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (isIP(unbracketed) !== 0) return blockedIpReason(unbracketed);

  if (BLOCKED_HOST_EXACT.has(host)) return 'internal-hostname';
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return 'internal-hostname';
  }
  // A bare label with no dot is a search-domain lookup - intranet by definition.
  if (!host.includes('.')) return 'internal-hostname';

  return null;
}

/** One flat sentence for the operator. Never names the range that matched. */
export function blockedReasonMessage(reason: BlockedReason): string {
  switch (reason) {
    case 'cloud-metadata':
    case 'internal-hostname':
      return 'This address is not reachable from the public internet.';
    case 'not-an-ip':
      return 'This address could not be understood.';
    default:
      return 'This address points inside a private network and cannot be used.';
  }
}
