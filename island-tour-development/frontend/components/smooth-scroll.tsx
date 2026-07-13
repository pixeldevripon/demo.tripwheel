'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function SmoothScroll() {
    const pathname = usePathname();

    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        // Awwwards-style premium smooth scroll configuration
        const lenis = new Lenis({
            lerp: .09, // Buttery smooth inertia (replaces duration/easing)
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1.1, // Slightly softer scroll steps
            touchMultiplier: 1.8, // Better touch responsiveness
            infinite: false,
        });
        lenisRef.current = lenis;

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    // Handle hash navigation on page load and route change
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash;
            // Use a small timeout to ensure DOM is ready and Lenis is initialized
            const timeoutId = setTimeout(() => {
                const targetElement = document.querySelector(
                    hash
                ) as HTMLElement;
                if (targetElement && lenisRef.current) {
                    lenisRef.current.scrollTo(targetElement, {
                        offset: -80,
                        duration: 1.2,
                    });
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

