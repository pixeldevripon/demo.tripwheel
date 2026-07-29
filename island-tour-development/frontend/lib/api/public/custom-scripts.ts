/**
 * Admin-pasted vendor snippets injected into every public page
 * (dashboard: Settings > Scripts).
 *
 * Hits `GET /custom-scripts/public`, which returns ONLY active snippets, already
 * split by injection point and ordered. An inactive snippet never reaches this
 * payload, so there is nothing here to filter - see the backend service for why
 * that filtering lives in the query.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

/**
 * One top-level element of a snippet, already parsed by the backend.
 *
 * The raw markup deliberately never crosses the wire: a `<head>` has nowhere to
 * put the wrapper element raw interpolation needs, and rendering a closed set of
 * known tags is a stronger guarantee than trusting a string. See
 * `components/frontend/tracking/custom-scripts.tsx`.
 */
export interface PublicCustomScriptNode {
    /** script | style | link | meta | noscript. */
    tag: string;
    attributes: Record<string, string>;
    /** Inner content for script/style/noscript; null for void elements. */
    html: string | null;
}

export interface PublicCustomScript {
    id: string;
    nodes: PublicCustomScriptNode[];
}

export interface PublicCustomScripts {
    /** Rendered inside <head>, in order. */
    head: PublicCustomScript[];
    /** Rendered as the last thing in <body>, in order. */
    bodyEnd: PublicCustomScript[];
}

const EMPTY: PublicCustomScripts = { head: [], bodyEnd: [] };

/**
 * `cacheLife('days')` with the `custom-scripts` tag: the dashboard busts the tag
 * on every write, so the long window costs nothing in staleness.
 *
 * Falls back to NO SCRIPTS when the backend is unreachable. That direction is
 * deliberate: a settings outage must degrade to "analytics missing for a few
 * minutes", never to "half a vendor snippet in the <head> of every page".
 */
export async function getPublicCustomScripts(): Promise<PublicCustomScripts> {
    'use cache';
    cacheLife('days');
    cacheTag('custom-scripts');

    const res = await publicGet<PublicCustomScripts>('/custom-scripts/public');
    if (!res) return EMPTY;

    return {
        head: (res.head ?? []).filter(isRenderable),
        bodyEnd: (res.bodyEnd ?? []).filter(isRenderable),
    };
}

/**
 * The tags the render path will emit, mirroring ROOT_TAGS in the backend's
 * `custom-scripts.util.ts`. Keep the two in step.
 */
const RENDERABLE_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript']);

/**
 * Render-time guard - defence in depth, NOT the primary control.
 *
 * The real validation runs on write (the backend's `custom-scripts.util.ts`,
 * applied through the DTO) and is far stricter. This exists for the case that
 * validator never sees: a row written straight into the database by a direct SQL
 * edit, a restored dump from before the rule existed, or a future endpoint that
 * forgets the DTO. Because the payload is already parsed, the check here is a
 * structural one on a tag name rather than a regex over a blob - a node whose
 * tag is not on the list simply never reaches React.
 *
 * A snippet with no renderable nodes left is dropped entirely rather than
 * rendered empty, so a tampered row shows up as "the tag is missing" instead of
 * silently half-executing.
 */
function isRenderable(script: PublicCustomScript): boolean {
    return (
        Array.isArray(script?.nodes) &&
        script.nodes.length > 0 &&
        script.nodes.every(node => RENDERABLE_TAGS.has(node?.tag))
    );
}
