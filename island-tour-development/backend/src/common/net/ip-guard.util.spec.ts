/**
 * The SSRF blocklist. Every case here is a real payload someone would try, so a
 * failure in this file means the server can be aimed at our own network.
 */
import {
  blockedHostnameReason,
  blockedIpReason,
  blockedReasonMessage,
} from './ip-guard.util';

describe('blockedIpReason', () => {
  describe('IPv4 that must be refused', () => {
    it.each([
      ['127.0.0.1', 'loopback'],
      ['127.255.255.254', 'loopback'],
      ['0.0.0.0', 'unspecified'],
      ['10.0.0.5', 'private'],
      ['10.255.255.255', 'private'],
      ['172.16.0.1', 'private'],
      ['172.31.255.255', 'private'],
      ['192.168.1.1', 'private'],
      // The one that hands over cloud credentials.
      ['169.254.169.254', 'link-local'],
      ['169.254.0.1', 'link-local'],
      ['100.64.0.1', 'reserved'], // carrier-grade NAT
      ['224.0.0.1', 'multicast'],
      ['255.255.255.255', 'reserved'],
      ['198.18.0.1', 'reserved'],
    ])('%s → %s', (address, reason) => {
      expect(blockedIpReason(address)).toBe(reason);
    });
  });

  describe('IPv4 that must be allowed', () => {
    it.each([
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.15.255.255', // just below the private block
      '172.32.0.0', // just above it
      '11.0.0.1', // just above 10/8
      '9.255.255.255', // just below 10/8
    ])('%s', (address) => {
      expect(blockedIpReason(address)).toBeNull();
    });
  });

  describe('IPv6 that must be refused', () => {
    it.each([
      ['::1', 'loopback'],
      ['::', 'unspecified'],
      ['fe80::1', 'link-local'],
      ['fc00::1', 'unique-local'],
      ['fd12:3456:789a::1', 'unique-local'], // fd00::/8 sits inside fc00::/7
      ['ff02::1', 'multicast'],
      ['2001:db8::1', 'reserved'],
    ])('%s → %s', (address, reason) => {
      expect(blockedIpReason(address)).toBe(reason);
    });

    // The classic bypass: loopback wearing a v6 costume matches no v6 blocklist
    // entry, so it must be unwrapped and re-checked as IPv4.
    describe('IPv4-mapped addresses are unwrapped, not waved through', () => {
      it.each([
        ['::ffff:127.0.0.1', 'loopback'],
        ['::ffff:169.254.169.254', 'link-local'],
        ['::ffff:10.0.0.1', 'private'],
        ['::ffff:192.168.1.1', 'private'],
      ])('%s → %s', (address, reason) => {
        expect(blockedIpReason(address)).toBe(reason);
      });

      it('still allows a mapped public address', () => {
        expect(blockedIpReason('::ffff:8.8.8.8')).toBeNull();
      });
    });
  });

  it('allows ordinary public IPv6', () => {
    expect(blockedIpReason('2606:4700:4700::1111')).toBeNull();
  });

  it('reports non-addresses rather than guessing', () => {
    expect(blockedIpReason('not-an-address')).toBe('not-an-ip');
    expect(blockedIpReason('999.1.1.1')).toBe('not-an-ip');
    expect(blockedIpReason('')).toBe('not-an-ip');
  });
});

describe('blockedHostnameReason', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    'metadata.google.internal',
    'metadata.goog',
    'anything.localhost',
    'printer.local',
    'db.internal',
    'api.corp',
    'box.lan',
  ])('refuses the infrastructure name %s', (host) => {
    expect(blockedHostnameReason(host)).toBe('internal-hostname');
  });

  // A name with no dot resolves through the resolver's search domain, which by
  // definition points somewhere internal.
  it('refuses a bare label', () => {
    expect(blockedHostnameReason('intranet')).toBe('internal-hostname');
  });

  it('validates an IP literal immediately, without waiting for DNS', () => {
    expect(blockedHostnameReason('127.0.0.1')).toBe('loopback');
    expect(blockedHostnameReason('169.254.169.254')).toBe('link-local');
    expect(blockedHostnameReason('[::1]')).toBe('loopback');
    expect(blockedHostnameReason('8.8.8.8')).toBeNull();
  });

  it('ignores the FQDN root dot and case', () => {
    expect(blockedHostnameReason('www.Airbnb.com.')).toBeNull();
  });

  it.each([
    'www.airbnb.com',
    'calendar.google.com',
    'admin.booking.com',
    'ical.getyourguide.com',
  ])('allows the real channel host %s', (host) => {
    expect(blockedHostnameReason(host)).toBeNull();
  });

  // A hostname that merely CONTAINS a blocked word is not blocked - only a real
  // suffix is. `mylocal.com` is a legitimate public domain.
  it('matches on suffix, not substring', () => {
    expect(blockedHostnameReason('mylocal.com')).toBeNull();
    expect(blockedHostnameReason('localhost.example.com')).toBeNull();
  });
});

describe('blockedReasonMessage', () => {
  // The operator gets one flat sentence; naming the matched range would tell a
  // prober exactly what our network looks like.
  it('never names the range that matched', () => {
    for (const reason of [
      'loopback',
      'private',
      'link-local',
      'unique-local',
      'multicast',
      'reserved',
      'unspecified',
    ] as const) {
      const message = blockedReasonMessage(reason);
      expect(message).toBe(
        'This address points inside a private network and cannot be used.',
      );
    }
  });
});
