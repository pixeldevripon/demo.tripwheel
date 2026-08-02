/**
 * URL handling and error classification for the operator-supplied feed fetcher.
 *
 * The IP blocklist has its own exhaustive spec (`ip-guard.util.spec.ts`); this
 * covers the layer above it - normalization, the pre-flight refusals, and the
 * transient/permanent split that decides whether a connection retries or dies.
 */
import {
  classifyHttpStatus,
  normalizeFeedUrl,
  safeFetchFeed,
  validateFeedUrl,
  type SafeFetchFailure,
} from './safe-http.util';

const asFailure = (value: unknown): SafeFetchFailure =>
  value as SafeFetchFailure;

describe('normalizeFeedUrl', () => {
  it('rewrites webcal:// to https://', () => {
    expect(normalizeFeedUrl('webcal://example.com/a.ics')).toBe(
      'https://example.com/a.ics',
    );
    expect(normalizeFeedUrl('WEBCAL://example.com/a.ics')).toBe(
      'https://example.com/a.ics',
    );
  });

  it('lowercases the host but never the path or query', () => {
    // OTA tokens are case sensitive - lowercasing one breaks the feed silently.
    expect(
      normalizeFeedUrl('https://WWW.Airbnb.com/Calendar/ICS?s=AbC123'),
    ).toBe('https://www.airbnb.com/Calendar/ICS?s=AbC123');
  });

  it('preserves every query parameter and its order', () => {
    const url = 'https://example.com/f.ics?b=2&a=1&token=Xy_-9';
    expect(normalizeFeedUrl(url)).toBe(url);
  });

  it('drops the fragment and the default port', () => {
    expect(normalizeFeedUrl('https://example.com:443/a.ics#frag')).toBe(
      'https://example.com/a.ics',
    );
  });

  it('keeps a non-default port', () => {
    expect(normalizeFeedUrl('https://example.com:8443/a.ics')).toContain(
      ':8443',
    );
  });

  it('strips surrounding whitespace and zero-width characters', () => {
    expect(normalizeFeedUrl('  https://example.com/a.ics​ ')).toBe(
      'https://example.com/a.ics',
    );
  });
});

describe('validateFeedUrl', () => {
  it('accepts a normal channel URL', () => {
    const result = validateFeedUrl(
      'https://www.airbnb.com/calendar/ical/1.ics?s=x',
    );
    expect(asFailure(result).ok).not.toBe(false);
  });

  it('accepts webcal by rewriting it', () => {
    const result = validateFeedUrl('webcal://p1.calendar.icloud.com/x.ics');
    expect(asFailure(result).ok).not.toBe(false);
  });

  it('refuses plain http', () => {
    expect(asFailure(validateFeedUrl('http://example.com/a.ics')).code).toBe(
      'URL_NOT_HTTPS',
    );
  });

  it.each(['file:///etc/passwd', 'ftp://example.com/a.ics', 'gopher://x/1'])(
    'refuses the %s scheme',
    (url) => {
      expect(asFailure(validateFeedUrl(url)).code).toBe('URL_NOT_HTTPS');
    },
  );

  // Credentials would be forwarded to wherever the redirect chain ends up.
  it('refuses embedded credentials', () => {
    expect(
      asFailure(validateFeedUrl('https://user:pass@example.com/a.ics')).code,
    ).toBe('URL_HAS_CREDENTIALS');
  });

  it('refuses malformed input', () => {
    expect(asFailure(validateFeedUrl('not a url')).code).toBe('URL_MALFORMED');
    expect(asFailure(validateFeedUrl('')).code).toBe('URL_MALFORMED');
  });

  describe('SSRF pre-flight', () => {
    it.each([
      'https://localhost/a.ics',
      'https://127.0.0.1/a.ics',
      'https://10.0.0.1/a.ics',
      'https://192.168.1.1/a.ics',
      'https://169.254.169.254/latest/meta-data/',
      'https://[::1]/a.ics',
      'https://metadata.google.internal/x.ics',
      'https://printer.local/a.ics',
    ])('refuses %s before any network call', (url) => {
      const result = asFailure(validateFeedUrl(url));
      expect(result.code).toBe('URL_BLOCKED_HOST');
      expect(result.transient).toBe(false);
    });

    // Every refusal reads the same, so the response cannot be used to map our
    // internal network by probing which addresses answer differently.
    it('gives one uniform message for every blocked address', () => {
      const messages = [
        'https://127.0.0.1/a.ics',
        'https://10.0.0.1/a.ics',
        'https://169.254.169.254/a.ics',
      ].map((u) => asFailure(validateFeedUrl(u)).message);
      expect(new Set(messages).size).toBe(1);
    });
  });
});

describe('classifyHttpStatus', () => {
  describe('permanent - stop immediately, retrying helps nobody', () => {
    it.each([400, 401, 403, 404, 410, 451])('%s', (status) => {
      expect(classifyHttpStatus(status).transient).toBe(false);
    });

    it('tells the operator what to do about a login wall', () => {
      expect(classifyHttpStatus(401).message).toContain('must be public');
      expect(classifyHttpStatus(403).message).toContain('must be public');
    });

    it('tells the operator to regenerate a dead link', () => {
      expect(classifyHttpStatus(404).message).toContain('Regenerate');
    });
  });

  describe('transient - retry on the ladder', () => {
    it.each([500, 502, 503, 504])('%s', (status) => {
      expect(classifyHttpStatus(status).transient).toBe(true);
    });

    // 4xx but genuinely retryable: treating these as permanent would disconnect
    // a healthy channel over one rate-limited afternoon.
    it.each([408, 425, 429])('%s despite being 4xx', (status) => {
      expect(classifyHttpStatus(status).transient).toBe(true);
    });

    it('does not blame the operator for a channel-side outage', () => {
      expect(classifyHttpStatus(503).message).toContain('keep trying');
    });
  });

  it('carries the status in both the code and the field', () => {
    const result = classifyHttpStatus(404);
    expect(result.code).toBe('HTTP_404');
    expect(result.httpStatus).toBe(404);
  });
});

describe('safeFetchFeed', () => {
  // Proves the guard is actually wired into the fetch path, not just exported.
  // No network call happens - the refusal is decided before DNS.
  it.each([
    'https://127.0.0.1:5432/a.ics',
    'https://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'https://10.0.0.5/admin.ics',
  ])('refuses %s without dialling', async (url) => {
    const result = asFailure(await safeFetchFeed(url));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('URL_BLOCKED_HOST');
  });

  it('refuses http before dialling', async () => {
    const result = asFailure(await safeFetchFeed('http://example.com/a.ics'));
    expect(result.code).toBe('URL_NOT_HTTPS');
  });

  it('reports an unresolvable host as transient', async () => {
    const result = asFailure(
      await safeFetchFeed('https://this-host-does-not-exist.invalid/a.ics'),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HOST_UNREACHABLE');
    // DNS can fail for a moment; a permanent verdict would kill a live connection.
    expect(result.transient).toBe(true);
  });
});
