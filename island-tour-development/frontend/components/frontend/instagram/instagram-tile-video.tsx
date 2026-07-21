'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * The video layer of a reel tile, laid over its always-mounted poster.
 *
 * Three things this exists to get right, none of which CSS can do:
 *
 * 1. It never downloads until the tile is near the viewport. Six autoplaying
 *    videos below the fold would otherwise cost megabytes on a page nobody has
 *    scrolled to yet.
 * 2. It pauses again on the way out, so a grid left off-screen stops decoding.
 * 3. Under `prefers-reduced-motion` it renders NOTHING and the poster stands in.
 *    A looping video is exactly what that setting is about, and no amount of
 *    CSS can stop an `autoPlay` attribute.
 *
 * Muted + `playsInline` are not optional: unmuted autoplay is blocked by every
 * browser, and without `playsInline` iOS takes the video fullscreen.
 */
export function InstagramTileVideo({
    src,
    poster,
}: {
    src: string;
    poster: string;
}) {
    const reducedMotion = useReducedMotion();
    const ref = useRef<HTMLVideoElement>(null);
    const [near, setNear] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || reducedMotion) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setNear(entry.isIntersecting);
                if (entry.isIntersecting) {
                    // Autoplay can still be refused (data saver, low power
                    // mode). Swallowing it leaves the poster showing, which is
                    // a perfectly good tile - never a broken one.
                    el.play().catch(() => {});
                } else {
                    el.pause();
                }
            },
            { rootMargin: '200px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [reducedMotion]);

    if (reducedMotion) return null;

    return (
        <video
            ref={ref}
            // Held back until the tile is close: `src` set on a <video> starts
            // fetching immediately, `preload='none'` or not.
            src={near ? src : undefined}
            poster={poster}
            muted
            loop
            playsInline
            preload='none'
            aria-hidden='true'
            tabIndex={-1}
            className='absolute inset-0 size-full object-cover'
        />
    );
}
