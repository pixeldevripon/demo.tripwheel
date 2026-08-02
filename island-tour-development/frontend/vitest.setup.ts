import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Global test setup.
 *
 * `restoreMocks: true` in the config resets spies between tests; this file
 * handles the things that are not spies - the DOM, and the browser APIs jsdom
 * does not implement that our components call unconditionally.
 */

afterEach(() => {
    cleanup();
});

/**
 * jsdom ships no `matchMedia`. `use-mobile.ts` and anything built on the
 * shadcn sidebar/drawer primitives call it during their first render, so its
 * absence is a TypeError in components that have nothing to do with media
 * queries. Defaults to "does not match" - i.e. the desktop branch.
 */
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }),
});

/** Used by carousels, drag-scroll and any Radix popper. Not in jsdom. */
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

/** Used for reveal-on-scroll animations. Not in jsdom. */
global.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
} as unknown as typeof IntersectionObserver;

/**
 * Radix menus, selects and dialogs call this on open. jsdom stubs it as a
 * throwing "not implemented", which surfaces as an unhandled error rather than
 * a test failure you can read.
 */
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
