'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/tracking/attribution';

/**
 * Captures ad click ids + UTM params from the landing URL into a first-party
 * cookie on first load (master 8.1 item 6), so they survive the funnel and reach
 * the reserve payload. Mounted once in the (frontend) layout; renders nothing.
 * Every external ad click is a full document load, so this runs for each new
 * landing; within-site SPA navigations carry no click ids and are harmless no-ops.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
