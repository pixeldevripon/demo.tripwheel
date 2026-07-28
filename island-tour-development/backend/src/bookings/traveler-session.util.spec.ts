/**
 * Direct tests for the traveler-session security primitive (hand-rolled HMAC
 * token). The service specs cover the happy paths through getThankYou /
 * requestCancellation; THESE tests own the failure branches - tamper, expiry,
 * malformed input - plus the PII maskers.
 */
import { createHmac } from 'crypto';
import {
  hashLoginCode,
  issueBookingSession,
  issueTravelerHistorySession,
  loginCodeMatches,
  issueTravelerSession,
  maskEmail,
  maskLastName,
  maskPhone,
  sessionHistoryEmail,
  sessionOwnsBooking,
  TRAVELER_SESSION_TTL_MS,
  verifyTravelerSession,
} from './traveler-session.util';

process.env.TRAVELER_SESSION_SECRET =
  'unit-test-traveler-secret-0123456789abcdef';

describe('issueTravelerSession / verifyTravelerSession', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('round-trips: a fresh email token verifies to the lowercased email claim', () => {
    const token = issueTravelerSession('  Guest@Example.TEST ');
    expect(verifyTravelerSession(token)).toEqual({
      email: 'guest@example.test',
      bookingId: null,
      history: false,
    });
  });

  it('round-trips: a booking token carries ONLY the booking id claim', () => {
    const token = issueBookingSession('b-123');
    expect(verifyTravelerSession(token)).toEqual({
      email: null,
      bookingId: 'b-123',
      history: false,
    });
  });

  it('round-trips: a history token carries the email claim WITH history', () => {
    const token = issueTravelerHistorySession('  Guest@Example.TEST ');
    expect(verifyTravelerSession(token)).toEqual({
      email: 'guest@example.test',
      bookingId: null,
      history: true,
    });
  });

  it('legacy pre-history payloads (no `h`) verify with history: false', () => {
    // Hand-sign the exact payload shape every token had before the history
    // flag existed - the 24h overlap window must keep accepting them.
    const payload = Buffer.from(
      JSON.stringify({ e: 'guest@example.test', exp: Date.now() + 60_000 }),
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.TRAVELER_SESSION_SECRET!)
      .update(payload)
      .digest()
      .toString('base64url');
    expect(verifyTravelerSession(`v1.${payload}.${sig}`)).toEqual({
      email: 'guest@example.test',
      bookingId: null,
      history: false,
    });
  });

  it('a forged unsigned history flag on a pair token is rejected outright', () => {
    // Take a real pair token, decode, add h:1, re-encode WITHOUT re-signing:
    // the signature no longer matches, so verification fails entirely.
    const token = issueTravelerSession('guest@example.test');
    const [v, payload, sig] = token.split('.');
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const forged = Buffer.from(JSON.stringify({ ...claims, h: 1 })).toString(
      'base64url',
    );
    expect(verifyTravelerSession(`${v}.${forged}.${sig}`)).toBeNull();
  });

  it('a booking-scoped payload can never be history, even if signed with h', () => {
    // Defense in depth: were a `{ b, h }` payload ever minted by mistake,
    // verify still refuses the history claim (history requires an email).
    const payload = Buffer.from(
      JSON.stringify({ b: 'b-123', h: 1, exp: Date.now() + 60_000 }),
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.TRAVELER_SESSION_SECRET!)
      .update(payload)
      .digest()
      .toString('base64url');
    expect(verifyTravelerSession(`v1.${payload}.${sig}`)?.history).toBe(false);
  });

  it('has the v1.<payload>.<sig> shape', () => {
    const token = issueTravelerSession('a@b.co');
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('rejects a tampered payload (email swap re-signed nowhere)', () => {
    const token = issueTravelerSession('guest@example.test');
    const [v, , sig] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ e: 'attacker@evil.test', exp: Date.now() + 60_000 }),
    ).toString('base64url');
    expect(verifyTravelerSession(`${v}.${forgedPayload}.${sig}`)).toBeNull();
  });

  it('rejects a tampered signature (single character flip)', () => {
    const token = issueTravelerSession('guest@example.test');
    const [v, payload, sig] = token.split('.');
    // Flip the FIRST signature char (a fully-significant base64url position).
    // NOT the last char: a 32-byte HMAC base64url-encodes to 43 chars whose
    // final char carries only 4 significant bits, so flipping it can decode to
    // the SAME signature bytes and legitimately still verify - a flaky tamper.
    const flippedSig = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyTravelerSession(`${v}.${payload}.${flippedSig}`)).toBeNull();
  });

  it('rejects a wrong-length signature without throwing', () => {
    const token = issueTravelerSession('guest@example.test');
    const [v, payload] = token.split('.');
    expect(verifyTravelerSession(`${v}.${payload}.QUJD`)).toBeNull();
  });

  it('rejects an EXPIRED token (25h later)', () => {
    const token = issueTravelerSession('guest@example.test');
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + TRAVELER_SESSION_TTL_MS + 60 * 60 * 1000);
    expect(verifyTravelerSession(token)).toBeNull();
  });

  it('still verifies just BEFORE expiry', () => {
    const token = issueTravelerSession('guest@example.test');
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + TRAVELER_SESSION_TTL_MS - 60_000);
    expect(verifyTravelerSession(token)?.email).toBe('guest@example.test');
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['v1'],
    ['v1.only-two'],
    ['v2.x.y'], // unknown version
    ['v1.not-base64-json!!.sig'],
    ['v1..'],
    ['a.b.c.d'], // too many parts
  ])('rejects malformed input %p without throwing', (input) => {
    expect(verifyTravelerSession(input)).toBeNull();
  });

  it('rejects a signed payload with wrong field types', () => {
    // Signed with the REAL secret but e/exp are the wrong types - the shape
    // check must reject it even though the signature is valid.
    const payload = Buffer.from(
      JSON.stringify({ e: 123, exp: 'tomorrow' }),
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.TRAVELER_SESSION_SECRET!)
      .update(payload)
      .digest()
      .toString('base64url');
    expect(verifyTravelerSession(`v1.${payload}.${sig}`)).toBeNull();
  });
});

describe('sessionOwnsBooking', () => {
  const emailClaims = {
    email: 'guest@example.test',
    bookingId: null,
    history: false,
  };
  const booking = { id: 'b-1', contactEmail: ' Guest@Example.TEST ' };

  it('email scope matches case-insensitively against the stored contact email', () => {
    expect(sessionOwnsBooking(emailClaims, booking)).toBe(true);
  });

  it('email scope never owns a booking without a contact email (no vacuous verify)', () => {
    expect(
      sessionOwnsBooking(emailClaims, { id: 'b-1', contactEmail: null }),
    ).toBe(false);
    expect(
      sessionOwnsBooking(emailClaims, { id: 'b-1', contactEmail: undefined }),
    ).toBe(false);
    expect(
      sessionOwnsBooking(emailClaims, { id: 'b-1', contactEmail: '' }),
    ).toBe(false);
  });

  it('a history token still owns bookings by email (strictly stronger)', () => {
    const claims = verifyTravelerSession(
      issueTravelerHistorySession('guest@example.test'),
    );
    expect(sessionOwnsBooking(claims, booking)).toBe(true);
  });

  it('booking scope owns EXACTLY its booking id - never a sibling with the same email', () => {
    const claims = { email: null, bookingId: 'b-1', history: false };
    expect(sessionOwnsBooking(claims, booking)).toBe(true);
    // The critical exploit shape: attacker PATCHes a throwaway booking with the
    // victim's email - the booking-scoped token must NOT unlock the victim's
    // other bookings even though contactEmail matches.
    expect(
      sessionOwnsBooking(claims, {
        id: 'b-victim',
        contactEmail: 'guest@example.test',
      }),
    ).toBe(false);
  });

  it('rejects null claims', () => {
    expect(sessionOwnsBooking(null, booking)).toBe(false);
  });
});

describe('sessionHistoryEmail', () => {
  it('returns the email only for OTP-proven history claims', () => {
    const historyClaims = verifyTravelerSession(
      issueTravelerHistorySession('Guest@Example.TEST'),
    );
    expect(sessionHistoryEmail(historyClaims)).toBe('guest@example.test');
  });

  it('rejects pair-login, checkout, and null claims alike', () => {
    expect(
      sessionHistoryEmail(
        verifyTravelerSession(issueTravelerSession('guest@example.test')),
      ),
    ).toBeNull();
    expect(
      sessionHistoryEmail(verifyTravelerSession(issueBookingSession('b-1'))),
    ).toBeNull();
    expect(sessionHistoryEmail(null)).toBeNull();
  });
});

describe('OTP login code hashing', () => {
  it('is deterministic and normalizes the email exactly like the session issuer', () => {
    const a = hashLoginCode('Guest@Example.TEST', '424242');
    const b = hashLoginCode('  guest@example.test  ', '424242');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('binds the hash to the email - the same code under another address differs', () => {
    expect(hashLoginCode('a@b.co', '424242')).not.toBe(
      hashLoginCode('c@d.co', '424242'),
    );
  });

  it('matches only the exact code', () => {
    const stored = hashLoginCode('guest@example.test', '424242');
    expect(loginCodeMatches('guest@example.test', '424242', stored)).toBe(true);
    expect(loginCodeMatches('guest@example.test', '424243', stored)).toBe(
      false,
    );
    // Right code, wrong owner.
    expect(loginCodeMatches('other@example.test', '424242', stored)).toBe(
      false,
    );
  });

  it('rejects a malformed stored hash without throwing', () => {
    expect(loginCodeMatches('guest@example.test', '424242', '')).toBe(false);
    expect(loginCodeMatches('guest@example.test', '424242', 'zz')).toBe(false);
  });
});

describe('PII maskers', () => {
  it('maskEmail keeps first chars + TLD only', () => {
    expect(maskEmail('devripon.io@gmail.com')).toBe('d•••@g•••.com');
    expect(maskEmail('a@b.co')).toBe('a•••@b•••.co');
  });

  it('maskEmail handles junk without throwing', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('no-at-sign')).toBe('•••');
    expect(maskEmail('@leading.at')).toBe('•••');
  });

  it('maskPhone keeps only the last two digits', () => {
    expect(maskPhone('+599 9 123 4568')).toBe('••• •• 68');
    expect(maskPhone(null)).toBeNull();
  });

  it('maskPhone fully masks values with fewer than 4 digits', () => {
    expect(maskPhone('12')).toBe('••• •• ••');
    expect(maskPhone('+1')).toBe('••• •• ••');
  });

  it('maskLastName keeps the initial', () => {
    expect(maskLastName('Mia')).toBe('M.');
    expect(maskLastName(null)).toBeNull();
    expect(maskLastName('')).toBe('');
  });
});
