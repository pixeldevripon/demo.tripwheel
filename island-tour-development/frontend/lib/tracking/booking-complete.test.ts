import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushBookingComplete } from './booking-complete';
import type { TypConversion } from '@/lib/api/public/bookings';

/**
 * The one dataLayer writer for `booking_complete` (master 8.3). These tests pin
 * the COMPOSITION of the event - the field names GTM variables are bound to -
 * so a rename or a dropped field fails here before it silently breaks the
 * container's four tags. The once-guard here only covers a single page load;
 * the authoritative guard is the server mark-first, exercised in the backend
 * spec (`claimConversionPush`).
 */

const HASH = 'a'.repeat(64);

// Every it() below MUST pass a unique eventId: pushBookingComplete's
// module-scope de-dupe Set is NOT reset between tests in this file, so a
// reused id makes a later test see an empty dataLayer at an unrelated assert.
const conversion = (over: Partial<TypConversion> = {}): TypConversion => ({
    event: 'Purchase',
    eventId: 'ref-1',
    bookingRef: 'IT-2030-AAAA',
    currency: 'EUR',
    value: '31.99',
    contentId: 't1',
    contentName: 'Sunset Sail',
    island: 'curacao',
    operatorId: 'op1',
    operatorName: 'Miss Ann Boat Trips',
    itemCategory: 'Boat Trips',
    userId: HASH,
    clickIds: null,
    userData: { sha256_email_address: HASH },
    ...over,
});

beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRACKING', 'true');
    window.dataLayer = [];
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('pushBookingComplete', () => {
    it('composes the full master 8.3 contract for an organic booking', () => {
        pushBookingComplete(conversion({ eventId: 'organic-1' }));

        expect(window.dataLayer).toHaveLength(1);
        const event = window.dataLayer![0];
        expect(event).toEqual({
            event: 'booking_complete',
            event_id: 'organic-1',
            booking_ref: 'IT-2030-AAAA',
            booking_value: 31.99,
            booking_currency: 'EUR',
            tour_id: 't1',
            tour_name: 'Sunset Sail',
            operator_id: 'op1',
            operator_name: 'Miss Ann Boat Trips',
            island: 'curacao',
            items: [
                {
                    item_id: 't1',
                    item_name: 'Sunset Sail',
                    item_brand: 'Miss Ann Boat Trips',
                    item_category: 'Boat Trips',
                    price: 31.99,
                    quantity: 1,
                },
            ],
            user_id: HASH,
            user_data: { sha256_email_address: HASH },
        });
        // Organic: the click_ids key is OMITTED, not null - GTM variables read
        // undefined, never a null object.
        expect('click_ids' in event).toBe(false);
    });

    it('carries only the click ids that were actually captured', () => {
        pushBookingComplete(
            conversion({
                eventId: 'clicked-1',
                clickIds: {
                    gclid: 'g-123',
                    gbraid: null,
                    wbraid: null,
                    fbclid: 'fb-456',
                },
            })
        );

        expect(window.dataLayer![0].click_ids).toEqual({
            gclid: 'g-123',
            fbclid: 'fb-456',
        });
    });

    it('omits user_id and user_data when there is no email to hash', () => {
        pushBookingComplete(
            conversion({ eventId: 'no-email-1', userId: null, userData: null })
        );

        const event = window.dataLayer![0];
        expect('user_id' in event).toBe(false);
        expect('user_data' in event).toBe(false);
    });

    it('is a no-op when tracking is disabled (staging guard)', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_TRACKING', 'false');
        pushBookingComplete(conversion({ eventId: 'disabled-1' }));
        expect(window.dataLayer).toHaveLength(0);
    });

    it('absorbs a StrictMode double-invoke within one load (same event id)', () => {
        pushBookingComplete(conversion({ eventId: 'strict-1' }));
        pushBookingComplete(conversion({ eventId: 'strict-1' }));
        expect(window.dataLayer).toHaveLength(1);
    });

    it('pushes nothing for a null payload (loser / unverified / unconfirmed)', () => {
        pushBookingComplete(null);
        expect(window.dataLayer).toHaveLength(0);
    });
});
