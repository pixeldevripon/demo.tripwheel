'use client';

import { SharePill } from '@/components/frontend/share-pill';

/**
 * Share control for the collection hero (Figma node 47433:2069 - the white
 * pill). The behaviour now lives in the shared `SharePill`, because the saved
 * tours page needs the identical control and two copies of a share-then-copy
 * fallback is two places for the confirmation to go missing.
 *
 * Kept as its own named export so the collection hero can stay a pure Server
 * Component with one `'use client'` leaf, and so the call site still says what
 * it is sharing.
 */
export function CollectionShareButton({
    label,
    copiedLabel,
}: {
    label: string;
    /** Shown for two seconds after the URL lands on the clipboard. */
    copiedLabel: string;
}) {
    return <SharePill label={label} copiedLabel={copiedLabel} />;
}
