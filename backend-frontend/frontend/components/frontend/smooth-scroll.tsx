'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Surfaces that keep the browser's NATIVE scroll.
 *
 * Lenis drives scrolling itself off a rAF loop with heavy inertia (lerp .09).
 * That reads as premium on editorial pages and as latency on a form - and on
 * checkout it is worse than latency, because the card fields are cross-origin
 * Stripe/Mollie iframes. A wheel event over an iframe belongs to the iframe and
 * never reaches Lenis, so the page scrolls with inertia over the form and
 * natively over the card inputs: the same gesture behaves differently depending
 * on where the cursor sits. Checkout also fires a native
 * `scrollIntoView({ behavior: 'smooth' })` when the payment step opens, which
 * fights the rAF loop for control of the scroll position at exactly the moment
 * the traveller reaches for the card number field.
 *
 * Keep this list to transactional surfaces. `/checkout` covers the processing
 * hop nested under it.
 */
const NATIVE_SCROLL_PATTERNS = [/\/checkout(?:\/|$)/];

function prefersNativeScroll(pathname: string): boolean {
    return NATIVE_SCROLL_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * NOTE: not currently mounted - `<SmoothScroll />` is commented out in
 * `app/(frontend)/layout.tsx` (since 2026-07-18), so nothing in this file runs
 * today. It is kept correct for whenever it is switched back on.
 */
export function SmoothScroll() {
    const pathname = usePathname();

    const lenisRef = useRef<Lenis | null>(null);

    // Keyed on the BOOLEAN, not the pathname: Lenis then survives ordinary
    // navigations and is only torn down when crossing into (or back out of) a
    // native-scroll surface. Keying the effect on `pathname` would destroy and
    // reconstruct the instance and its rAF loop on EVERY route change, which it
    // never used to do.
    const nativeScroll = prefersNativeScroll(pathname);

    useEffect(() => {
        // Transactional surface: leave the browser's own scrolling alone.
        if (nativeScroll) {
            lenisRef.current = null;
            return;
        }

        // Awwwards-style premium smooth scroll configuration
        const lenis = new Lenis({
            lerp: 0.09, // Buttery smooth inertia (replaces duration/easing)
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1.1, // Slightly softer scroll steps
            touchMultiplier: 1.8, // Better touch responsiveness
            infinite: false,
        });
        lenisRef.current = lenis;

        // The frame handle is captured so cleanup can CANCEL the loop. Without
        // it, `lenis.destroy()` released the instance but the recursive
        // requestAnimationFrame kept running forever, calling `.raf()` on a
        // destroyed Lenis at 60fps - and a fresh loop was started on every
        // remount, stacking one more each time.
        let frame = 0;
        const raf = (time: number) => {
            lenis.raf(time);
            frame = requestAnimationFrame(raf);
        };
        frame = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(frame);
            lenis.destroy(); // restores native scrolling
            lenisRef.current = null;
        };
    }, [nativeScroll]);

    // Handle hash navigation on page load and route change
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash;
            // Use a small timeout to ensure DOM is ready and Lenis is initialized
            const timeoutId = setTimeout(() => {
                const targetElement = document.querySelector(
                    hash
                ) as HTMLElement;
                if (!targetElement) return;
                if (lenisRef.current) {
                    lenisRef.current.scrollTo(targetElement, {
                        offset: -80,
                        duration: 1.2,
                    });
                } else {
                    // Native-scroll surface - no Lenis to drive it.
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500); // Increased timeout to 500ms slightly safer for hydration

            return () => clearTimeout(timeoutId);
        }
    }, [pathname]); // Re-run when route changes

    // Handle same-page hash clicks (optional, if Next.js Link doesn't handle it well with Lenis)
    useEffect(() => {
        const handleHashClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement;
            if (anchor) {
                // Check if it's a same-page hash link
                const href = anchor.getAttribute('href');
                // Without Lenis the browser's own anchor handling is already
                // correct, so this only intercepts while Lenis owns the scroll.
                if (href && href.startsWith('#') && lenisRef.current) {
                    e.preventDefault();
                    const targetElement = document.querySelector(
                        href
                    ) as HTMLElement;
                    if (targetElement) {
                        lenisRef.current.scrollTo(targetElement, {
                            offset: -80,
                            duration: 1.2,
                        });
                        // Manually update URL hash without scrolling
                        window.history.pushState({}, '', href);
                    }
                }
            }
        };
        document.addEventListener('click', handleHashClick);
        return () => document.removeEventListener('click', handleHashClick);
    }, []);

    return null;
}
