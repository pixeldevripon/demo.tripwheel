/**
 * Tiny external store bridging listing-refresh pending state ACROSS React
 * subtrees. The mobile date pill lives in the streamed header (outside
 * <ToursBrowser>), so its navigation transition can't reach the browser's
 * context - but the results grid still has to dim while the filtered page
 * streams, exactly like a toolbar-driven change. The pill publishes here; the
 * browser subscribes via useSyncExternalStore.
 */

type Listener = () => void;

let pending = false;
const listeners = new Set<Listener>();

export function setListingPending(value: boolean): void {
    if (pending === value) return;
    pending = value;
    for (const listener of listeners) listener();
}

export function subscribeListingPending(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getListingPending(): boolean {
    return pending;
}

/** SSR snapshot - the server never has an in-flight client transition. */
export function getListingPendingServer(): boolean {
    return false;
}
