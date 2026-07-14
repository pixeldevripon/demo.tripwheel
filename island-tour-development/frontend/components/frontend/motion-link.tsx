'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

/**
 * `next/link` with motion props - the ONLY way to animate an internal link.
 * Keeps client-side navigation (prefetch + the sitewide `PageTransition`
 * entrance) while supporting `whileTap` etc. A raw `motion.a href=...` does a
 * full page reload: slow, unprefetched, and it skips the page transition.
 */
export const MotionLink = motion.create(Link);
