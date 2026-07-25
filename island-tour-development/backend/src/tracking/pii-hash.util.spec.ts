import { createHash } from 'crypto';
import {
  computeHashedPii,
  toGoogleUserData,
  toMetaUserData,
} from './pii-hash.util';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

describe('computeHashedPii', () => {
  it('lowercases + trims email before hashing', () => {
    const { email } = computeHashedPii({ email: '  Ada@Example.COM ' });
    expect(email).toBe(sha('ada@example.com'));
  });

  it('normalizes a phone to E.164 before hashing', () => {
    // US number in national-ish form -> +12125550100 (E.164), then hashed.
    const { phone } = computeHashedPii({ phone: '+1 (212) 555-0100' });
    expect(phone).toBe(sha('+12125550100'));
  });

  it('omits fields that are blank or absent (never hashes an empty string)', () => {
    const h = computeHashedPii({
      email: '  ',
      phone: null,
      firstName: undefined,
    });
    expect(h.email).toBeUndefined();
    expect(h.phone).toBeUndefined();
    expect(h.firstName).toBeUndefined();
  });

  it('hashes name + address fields (trim + lowercase)', () => {
    const h = computeHashedPii({
      firstName: 'Ripon',
      lastName: 'Mia',
      city: 'Willemstad',
      postalCode: '1011',
      country: 'CW',
    });
    expect(h.firstName).toBe(sha('ripon'));
    expect(h.lastName).toBe(sha('mia'));
    expect(h.city).toBe(sha('willemstad'));
    expect(h.postalCode).toBe(sha('1011'));
    expect(h.country).toBe(sha('cw'));
  });
});

describe('toGoogleUserData', () => {
  it('requires an email (the one required 8.3 field) - returns undefined without it', () => {
    expect(toGoogleUserData({ phone: sha('x') })).toBeUndefined();
  });

  it('nests address fields and includes present optionals only', () => {
    const data = toGoogleUserData(
      computeHashedPii({
        email: 'ada@example.com',
        firstName: 'Ada',
        city: 'Willemstad',
      }),
    );
    expect(data?.sha256_email_address).toBe(sha('ada@example.com'));
    expect(data?.sha256_first_name).toBe(sha('ada'));
    expect(data?.address).toEqual({ sha256_city: sha('willemstad') });
    expect(data?.sha256_phone_number).toBeUndefined();
  });
});

describe('toMetaUserData', () => {
  it('maps the SAME hashes onto Metas array-valued keys (one pass, both platforms)', () => {
    const hashed = computeHashedPii({
      email: 'ada@example.com',
      country: 'CW',
    });
    const google = toGoogleUserData(hashed);
    const meta = toMetaUserData(hashed);
    // Identical hash value, different envelope - never a per-platform re-hash.
    expect(meta.em).toEqual([google?.sha256_email_address]);
    expect(meta.country).toEqual([sha('cw')]);
  });
});
