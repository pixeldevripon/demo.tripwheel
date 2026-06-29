/** Shared open/close animation for every navbar dropdown. */
export const dropdownMotion = {
    initial: { opacity: 0, y: -8, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.97 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
} as const;
