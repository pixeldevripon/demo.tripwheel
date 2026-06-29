'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Calls `handler` on a pointerdown outside `ref`. Pass `enabled = false` to
 * detach the listener while the menu is closed.
 *
 * Each navbar dropdown owns its own ref + this hook, so opening one closes any
 * other (the new trigger is "outside" the open menu) without a shared
 * coordinator - the only state lives inside each self-contained dropdown.
 */
export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    handler: () => void,
    enabled = true
) {
    useEffect(() => {
        if (!enabled) return;
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                handler();
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [ref, handler, enabled]);
}
