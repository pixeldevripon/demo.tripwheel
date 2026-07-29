'use client';

import { useSyncExternalStore } from 'react';

import {
    getServerTravellerIdentity,
    getTravellerIdentity,
    subscribeTravellerIdentity,
    type TravellerIdentity,
} from '@/lib/traveler-booking';

/**
 * Who is signed in on the public site, kept live.
 *
 * `useSyncExternalStore` rather than a mount effect for two reasons:
 *
 * 1. It re-reads on the FIRST render after hydration, not after paint. The
 *    account icon used to spend a whole frame as the signed-out link even for a
 *    signed-in traveller, so a quick click navigated to /traveller instead of
 *    opening the menu - which read as the menu being slow.
 * 2. It stays subscribed. Signing in at the account door, looking a booking up
 *    at /bookings, or signing out all notify the store, so the navbar updates
 *    in the same session instead of waiting for a browser reload.
 *
 * The server snapshot is always the signed-out one: the identity lives in a
 * cookie the prerendered shell deliberately never reads.
 */
export function useTravellerIdentity(): TravellerIdentity {
    return useSyncExternalStore(
        subscribeTravellerIdentity,
        getTravellerIdentity,
        getServerTravellerIdentity,
    );
}
