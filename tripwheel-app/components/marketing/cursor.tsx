'use client';

import { useEffect, useRef } from 'react';

/**
 * Custom cursor for the marketing surface: a brand dot that tracks the pointer
 * 1:1 plus a trailing ring eased with a rAF lerp. The ring blooms over
 * interactive elements.
 *
 * Positioning happens through `element.style` in the animation loop - there is
 * no class-based equivalent for a per-frame transform, and 03 §8.3 only bans
 * the JSX `style` attribute. Coarse pointers and reduced-motion users never see
 * it (the effect bails and the CSS hides it as a belt-and-braces).
 */
export function MarketingCursor() {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const dot = dotRef.current;
        const ring = ringRef.current;
        if (!dot || !ring) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;

        let x = -100;
        let y = -100;
        let ringX = -100;
        let ringY = -100;
        let visible = false;
        let raf = 0;

        const onMove = (event: MouseEvent) => {
            x = event.clientX;
            y = event.clientY;
            if (!visible) {
                visible = true;
                // Snap the ring to the entry point so it never streaks in
                // from the corner on first movement.
                ringX = x;
                ringY = y;
                dot.classList.add('is-visible');
                ring.classList.add('is-visible');
            }
        };

        const onOver = (event: MouseEvent) => {
            const target = event.target as Element | null;
            const interactive = !!target?.closest?.(
                'a, button, [role="button"], input, textarea, select, label, summary'
            );
            dot.classList.toggle('is-active', interactive);
            ring.classList.toggle('is-active', interactive);
        };

        const onLeave = () => {
            visible = false;
            dot.classList.remove('is-visible');
            ring.classList.remove('is-visible');
        };

        const tick = () => {
            ringX += (x - ringX) * 0.16;
            ringY += (y - ringY) * 0.16;
            dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
            raf = requestAnimationFrame(tick);
        };

        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('mouseover', onOver, { passive: true });
        document.documentElement.addEventListener('mouseleave', onLeave);
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseover', onOver);
            document.documentElement.removeEventListener('mouseleave', onLeave);
        };
    }, []);

    return (
        <>
            <div ref={dotRef} className='mk-cursor-dot' aria-hidden='true' />
            <div ref={ringRef} className='mk-cursor-ring' aria-hidden='true' />
        </>
    );
}
