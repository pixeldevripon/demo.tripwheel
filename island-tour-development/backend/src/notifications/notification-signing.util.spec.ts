import {
  generateSubscriptionSecret,
  signNotification,
  verifyNotification,
} from './notification-signing.util';

describe('signNotification', () => {
  it('produces a stable sha256= HMAC for the same body + secret', () => {
    const body = JSON.stringify({ id: 'n1', notificationType: 'AVAILABILITY_UPDATE' });
    const a = signNotification(body, 'secret');
    const b = signNotification(body, 'secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('changes when the secret or body changes', () => {
    const body = '{"a":1}';
    expect(signNotification(body, 's1')).not.toBe(signNotification(body, 's2'));
    expect(signNotification('{"a":1}', 's1')).not.toBe(
      signNotification('{"a":2}', 's1'),
    );
  });
});

describe('verifyNotification', () => {
  const body = '{"hello":"world"}';
  const secret = 'shared-secret';

  it('verifies a valid signature', () => {
    const sig = signNotification(body, secret);
    expect(verifyNotification(body, secret, sig)).toBe(true);
  });

  it('rejects a tampered body, wrong secret, or missing signature', () => {
    const sig = signNotification(body, secret);
    expect(verifyNotification('{"hello":"mars"}', secret, sig)).toBe(false);
    expect(verifyNotification(body, 'other', sig)).toBe(false);
    expect(verifyNotification(body, secret, undefined)).toBe(false);
    expect(verifyNotification(body, secret, 'sha256=deadbeef')).toBe(false);
  });
});

describe('generateSubscriptionSecret', () => {
  it('returns 64 hex chars and is non-deterministic', () => {
    const a = generateSubscriptionSecret();
    const b = generateSubscriptionSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
