/**
 * Direct tests for the traveler-session security primitive (hand-rolled HMAC
 * token). The service specs cover the happy paths through getThankYou /
 * requestCancellation; THESE tests own the failure branches - tamper, expiry,
 * malformed input - plus the PII maskers.
 */
import { createHmac } from 'crypto';
import {
  issueBookingSession,
  issueTravelerSession,
  maskEmail,
  maskLastName,
  maskPhone,
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
    });
  });

  it('round-trips: a booking token carries ONLY the booking id claim', () => {
    const token = issueBookingSession('b-123');
    expect(verifyTravelerSession(token)).toEqual({
      email: null,
      bookingId: 'b-123',
    });
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
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyTravelerSession(flipped)).toBeNull();
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
  const emailClaims = { email: 'guest@example.test', bookingId: null };
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

  it('booking scope owns EXACTLY its booking id - never a sibling with the same email', () => {
    const claims = { email: null, bookingId: 'b-1' };
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
