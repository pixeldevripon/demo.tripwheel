import { createElement, type ReactNode } from 'react';

import {
    getPublicCustomScripts,
    type PublicCustomScriptNode,
} from '@/lib/api/public/custom-scripts';

/**
 * Injects the admin-managed vendor snippets (dashboard: Settings > SEO > Custom
 * Scripts) into every public page.
 *
 * ## Why this renders from parsed nodes, not a raw string
 *
 * The backend sends each snippet already parsed into its top-level elements
 * (`{tag, attributes, html}`), not the markup blob the admin typed. Two reasons,
 * both load-bearing:
 *
 * 1. A `<head>` has nowhere to put the wrapper element that
 *    `dangerouslySetInnerHTML` needs - a `<div>` there is invalid and ends the
 *    head early, detaching everything after it.
 * 2. Re-emitting a closed set of five known tags is a far stronger guarantee
 *    than interpolating a string. Even a row written straight into the database,
 *    bypassing the write-path allowlist entirely, can only ever come out of here
 *    as a script/style/link/meta/noscript. This is the last link in that chain;
 *    the first is `custom-scripts.util.ts` in the backend.
 *
 * The script BODY is still injected verbatim - that is the entire feature, and
 * no amount of validation upstream changes the fact that this runs a vendor's
 * JavaScript. What makes it defensible is that the row can only be written by an
 * admin holding `MANAGE_SETTINGS`, the same permission that controls the payment
 * keys. It is never visitor input.
 *
 * ## Why these are PLAIN script tags, not `next/script`
 *
 * `next/script` was the obvious choice - `google-tag-manager.tsx` in this very
 * folder uses it - and it is the wrong one HERE, for a reason that only shows up
 * with admin-supplied code.
 *
 * `next/script` re-creates the element on the client and calls
 * `document.body.appendChild()` inside a React passive effect. Appending an
 * inline `<script>` executes it SYNCHRONOUSLY, so a snippet with a JavaScript
 * syntax error throws out of `appendChild`, out of the effect, and into React's
 * commit phase - which takes down the entire page render. One admin pasting
 * TypeScript by mistake blanked the whole site with a framework error overlay.
 *
 * A server-rendered `<script>` cannot do that. It executes when the browser
 * parses the document, so a broken snippet is an ordinary uncaught script error:
 * logged in the console, page unaffected, every other snippet still runs. For a
 * feature whose whole input is code someone pasted, that isolation is worth more
 * than any loading strategy - and there is no strategy to lose, because document
 * order already IS the ordering guarantee.
 *
 * It also executes exactly once per document: React matches the existing DOM
 * node on hydration rather than re-inserting it, and the root layout is not
 * re-rendered on soft navigation.
 *
 * ## Where each tag actually lands
 *
 * Verified against the rendered document, because the answer is not what the
 * position name suggests:
 *
 *   tag              | saved "Header"  | saved "Footer"
 *   -----------------|-----------------|----------------
 *   <meta> <link>    | <head>          | <head>
 *   <script async>   | <head>          | <head>
 *   <script> inline  | <head>          | end of <body>
 *   <style>          | <head>          | end of <body>
 *   <noscript>       | refused on save | end of <body>
 *
 * "Header" really is the head. The root layout renders an explicit `<head>` for
 * this block - see the comment there for why that is safe alongside the Metadata
 * API. Without it, only the tags React hoists on its own (`<meta>`, `<link>`,
 * async `<script src>`) reached the head; an inline `<script>` or a `<style>`
 * fell to the top of `<body>`.
 *
 * `<noscript>` stays refused in Header, and matters MORE now that this really is
 * the head: a browser closes `<head>` the moment it meets one, detaching every
 * tag after it.
 *
 * `beforeInteractive` only works from the root layout, which is where this
 * component is mounted. Do not move it into a route group.
 */
export async function CustomScripts({
    position,
}: {
    /** `head` runs before hydration; `bodyEnd` renders last in <body>. */
    position: 'head' | 'bodyEnd';
}) {
    const scripts = await getPublicCustomScripts();
    const block = position === 'head' ? scripts.head : scripts.bodyEnd;
    if (block.length === 0) return null;

    return (
        <>
            {block.flatMap(script =>
                script.nodes.map((node, index) =>
                    renderNode(node, `${script.id}-${index}`)
                )
            )}
        </>
    );
}

/** Tags with no children - rendering `dangerouslySetInnerHTML` on them throws. */
const VOID_TAGS = new Set(['link', 'meta']);

/**
 * The only tags that may be rendered, mirroring ROOT_TAGS in the backend's
 * `custom-scripts.util.ts`. Anything else is dropped silently: by this point it
 * should be unreachable, and omitting one node beats throwing on every page of
 * the site.
 */
const RENDERABLE = new Set(['script', 'style', 'link', 'meta', 'noscript']);

/**
 * HTML attribute names React spells differently. Everything not listed passes
 * through as authored - React renders unknown lowercase attributes verbatim,
 * which is what a vendor's `data-*` and custom attributes need.
 */
const REACT_PROP_NAMES: Record<string, string> = {
    class: 'className',
    for: 'htmlFor',
    charset: 'charSet',
    'http-equiv': 'httpEquiv',
    crossorigin: 'crossOrigin',
    referrerpolicy: 'referrerPolicy',
    srcset: 'srcSet',
    tabindex: 'tabIndex',
};

/**
 * Attributes that are present-or-absent in HTML but booleans in React. The
 * parser reports them as `""`, which React would render as `async=""` while
 * warning about a non-boolean value on a boolean attribute.
 */
const BOOLEAN_ATTRS = new Set(['async', 'defer', 'nomodule']);

function toReactProps(attributes: Record<string, string>) {
    const props: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(attributes)) {
        const key = REACT_PROP_NAMES[name] ?? name;
        props[key] = BOOLEAN_ATTRS.has(name) ? true : value;
    }
    return props;
}

function renderNode(node: PublicCustomScriptNode, key: string): ReactNode {
    if (!RENDERABLE.has(node.tag)) return null;

    const props = toReactProps(node.attributes);

    if (node.tag === 'script') {
        const inline = node.html ?? '';
        return inline.trim()
            ? createElement('script', {
                  ...props,
                  key,
                  dangerouslySetInnerHTML: { __html: inline },
                  // The server already emitted this exact tag; React must not
                  // re-write the node and re-run the snippet on hydration.
                  suppressHydrationWarning: true,
              })
            : createElement('script', { ...props, key });
    }

    if (VOID_TAGS.has(node.tag)) {
        // React 19 hoists <link> and <meta> into <head> from anywhere in the
        // tree, so these land correctly whichever position they were saved at.
        return createElement(node.tag, { ...props, key });
    }

    // <style> and <noscript>. A <noscript> body is inert for anyone running
    // JavaScript, and the backend refuses one in HEAD outright (a browser closes
    // the head when it meets one), so its raw inner markup only ever reaches the
    // end of <body> - which is exactly where GTM's own noscript iframe belongs.
    return createElement(node.tag, {
        ...props,
        key,
        dangerouslySetInnerHTML: { __html: node.html ?? '' },
    });
}
