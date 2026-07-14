'use client';

import { motion } from 'framer-motion';

/**
 * Motion elements re-exported as client references so SERVER components can
 * render them directly with serializable props (whileTap, transition,
 * initial/animate objects). This keeps a section server-rendered when its only
 * "interactivity" is declarative motion - the STRONG RULE: never mark a whole
 * component 'use client' for a leaf that isn't.
 *
 * NOT for anything with event handlers (onClick etc.) - handlers can't cross
 * the server boundary; that portion must be its own small client component.
 * Internal links use `MotionLink` (./motion-link); `MotionA` is for EXTERNAL
 * targets only.
 */
export const MotionDiv = motion.div;
export const MotionSpan = motion.span;
export const MotionButton = motion.button;
export const MotionA = motion.a;
