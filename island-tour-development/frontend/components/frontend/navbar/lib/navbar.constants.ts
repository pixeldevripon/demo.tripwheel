import { dropdownItemMotion, dropdownMotion, springPop } from '@/lib/motion';

/**
 * Navbar motion - thin aliases over the canonical `@/lib/motion` standard
 * (thank-you page language) so every navbar call site shares the exact
 * sitewide values.
 */
export { dropdownItemMotion, dropdownMotion };

/** Canonical press spring (re-exported for navbar call sites). */
export const pressSpring = springPop;

/** Icon-button press feedback - tap squash only (TYP language: hovers are
 *  color/opacity transitions, never scale-ups). */
export const iconPress = {
    whileTap: { scale: 0.9 },
    transition: springPop,
} as const;
