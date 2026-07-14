import { springPop } from '@/lib/motion';

/**
 * Shared open/close animation for every navbar dropdown. Variants-based so the
 * panel springs open (no abrupt tween cutoff) and its items - anything inside
 * carrying `dropdownItemMotion` - cascade in behind it; closing is a fast clean
 * fade so the UI never feels laggy on dismiss. Spring values come from the
 * canonical `@/lib/motion` standard (thank-you page language).
 */
export const dropdownMotion = {
    initial: 'closed',
    animate: 'open',
    exit: 'closed',
    variants: {
        open: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...springPop,
                staggerChildren: 0.03,
                delayChildren: 0.02,
            },
        },
        closed: {
            opacity: 0,
            y: -10,
            scale: 0.96,
            transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
        },
    },
} as const;

/** Per-item cascade inside a `dropdownMotion` panel (inherits open/closed). */
export const dropdownItemMotion = {
    variants: {
        open: { opacity: 1, y: 0, transition: springPop },
        closed: { opacity: 0, y: -6 },
    },
} as const;

/** Canonical press spring (re-exported for navbar call sites). */
export const pressSpring = springPop;

/** Icon-button press feedback - tap squash only (TYP language: hovers are
 *  color/opacity transitions, never scale-ups). */
export const iconPress = {
    whileTap: { scale: 0.9 },
    transition: springPop,
} as const;
