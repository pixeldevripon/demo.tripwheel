import * as vm from 'vm';

import { Parser } from 'htmlparser2';

/**
 * Structural validation for the admin-pasted markup in
 * Settings > Scripts (`CustomScript.code`, one row per snippet).
 *
 * ## What this does and does NOT protect against
 *
 * This is NOT a sanitiser and it cannot be one. The whole point of the feature
 * is to run a vendor's JavaScript on every public page, so the CONTENTS of a
 * `<script>` are arbitrary by definition - there is no rule that separates
 * "Hotjar" from "exfiltrate the checkout form". The actual control is that only
 * an ADMIN (`MANAGE_SETTINGS`) can write these fields; anyone who can reach the
 * endpoint could already change the payment keys.
 *
 * What this DOES do is stop the markup around the script from breaking or
 * hijacking the document, which is where the accidents and the privilege
 * escalations live:
 *
 * - **A root allowlist.** Only `<script> <style> <link> <meta> <noscript>` may
 *   appear at the top level - the tags that legitimately belong in a head/footer
 *   snippet. Everything else is refused by default rather than enumerated as
 *   banned, so a tag nobody thought of is denied, not allowed.
 * - **`<base>` is therefore impossible.** A single `<base href>` silently
 *   re-points every relative URL on the site, including form actions. It is the
 *   quietest defacement there is and it is why an allowlist beats a blocklist.
 * - **No stray text at the root.** Loose text in `<head>` makes the browser
 *   close head and open body early, which detaches everything after it.
 * - **Nothing may be left unclosed.** An unterminated `<script>` swallows the
 *   rest of the document - one typo takes the whole site down, on every page.
 * - **No `on*` handlers, no `javascript:`/`vbscript:`/`data:text/html` URLs.**
 *   Pointless in a snippet that can already open a `<script>`, but they are the
 *   signature of pasted-from-somewhere-bad markup, so refusing them turns a
 *   silent compromise into a visible error.
 *
 * `<iframe>` and image/markup tags are allowed ONLY inside `<noscript>`: that is
 * exactly the shape of Google Tag Manager's own snippet, which every admin will
 * paste, and a `<noscript>` body only renders for a visitor with JavaScript off.
 */

/**
 * Per-field ceiling. Comfortably above any real snippet (GTM + a chat widget +
 * a verification tag is well under 4 KB) while keeping a runaway paste out of
 * every page's HTML, where it would cost real TTFB.
 */
export const CUSTOM_SCRIPTS_MAX_LENGTH = 20_000;

/** The only tags allowed at the top level of a snippet. */
const ROOT_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript']);

/**
 * Allowed inside `<noscript>` only. GTM's official snippet is an `<iframe>` in a
 * `<noscript>`, and a no-JS pixel is an `<img>`; both are inert for anyone with
 * JavaScript on, which is why they are tolerable here and nowhere else.
 */
const NOSCRIPT_TAGS = new Set([
  'iframe',
  'img',
  'div',
  'span',
  'p',
  'a',
  'style',
  'link',
]);

/**
 * Self-closing by definition, so the parser reporting their close as "implied"
 * is correct rather than a sign of unbalanced markup.
 */
const VOID_TAGS = new Set(['link', 'meta', 'img', 'br', 'hr', 'source']);

/** Attributes that carry a URL and therefore a scheme worth checking. */
const URL_ATTRIBUTES = new Set([
  'src',
  'href',
  'action',
  'formaction',
  'data',
  'poster',
  'background',
  'xlink:href',
]);

/** Schemes that execute rather than fetch. */
const DANGEROUS_SCHEME = /^\s*(javascript|vbscript):|^\s*data:text\/html/i;

/**
 * `type` values on a `<script>` whose body is CLASSIC JavaScript, and so can be
 * syntax-checked. Anything else - `module` (import/export never compiles as a
 * classic script), `application/ld+json` (JSON-LD, extremely common to paste),
 * `text/template`, `text/x-handlebars` - is left alone: it is not JS, and
 * "checking" it would reject perfectly good snippets.
 */
const CLASSIC_SCRIPT_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
]);

export interface CustomScriptsCheck {
  ok: boolean;
  /** Admin-facing reason, safe to return in a 400. Null when ok. */
  reason: string | null;
}

/**
 * One top-level element of a snippet, normalised for rendering.
 *
 * The public site renders from THESE, not from the raw string. Two reasons:
 * a `<head>` cannot contain a wrapper element, so raw interpolation has nowhere
 * to go there; and re-emitting a closed set of tags means the render path can
 * only ever produce tags this allowlist knows, rather than trusting a string.
 * The admin still edits, and the database still stores, the code verbatim.
 */
export interface CustomScriptNode {
  tag: string;
  attributes: Record<string, string>;
  /** Inner content for script/style/noscript; null for void elements. */
  html: string | null;
}

const OK: CustomScriptsCheck = { ok: true, reason: null };

const fail = (reason: string): CustomScriptsCheck => ({ ok: false, reason });

/**
 * Check one snippet. Empty/blank is always valid - that is how an admin clears
 * the field.
 *
 * `position` matters for one rule: `<noscript>` is refused in HEAD. A
 * `<noscript>` holding an `<iframe>` (the Google Tag Manager shape) is not valid
 * head content, and a browser that meets it there closes `<head>` and opens
 * `<body>` early - detaching every tag after it. BODY_END is where that snippet
 * belongs anyway.
 *
 * Never throws: htmlparser2 is deliberately lenient, so anything it cannot make
 * sense of surfaces as a rejected tag rather than an exception, and a parser
 * error is reported as a validation failure instead of a 500.
 */
export function checkCustomScripts(
  value: string,
  position: 'HEAD' | 'BODY_END' = 'BODY_END',
): CustomScriptsCheck {
  if (!value || !value.trim()) return OK;

  if (value.length > CUSTOM_SCRIPTS_MAX_LENGTH) {
    return fail(
      `Script block is ${value.length} characters; the limit is ${CUSTOM_SCRIPTS_MAX_LENGTH}.`,
    );
  }

  // First failure wins - the admin fixes one thing at a time, and reporting the
  // first offending tag is more useful than a list of cascading complaints.
  let failure: CustomScriptsCheck | null = null;
  const open: string[] = [];
  let noscriptDepth = 0;
  let inScript = false;
  let scriptType = '';

  const reject = (reason: string) => {
    failure ??= fail(reason);
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (failure) return;
        const tag = name.toLowerCase();

        if (noscriptDepth > 0) {
          if (!NOSCRIPT_TAGS.has(tag) && tag !== 'noscript') {
            reject(`<${tag}> is not allowed inside <noscript>.`);
            return;
          }
        } else if (!ROOT_TAGS.has(tag)) {
          reject(
            tag === 'iframe'
              ? '<iframe> is only allowed inside <noscript> (that is how the Google Tag Manager snippet is shaped).'
              : `<${tag}> is not allowed here. Use only <script>, <style>, <link>, <meta> or <noscript>.`,
          );
          return;
        } else if (tag === 'noscript' && position === 'HEAD') {
          reject(
            '<noscript> cannot go in the <head> - a browser closes the head when it meets one, which detaches every tag after it. Set this snippet to "Footer" instead.',
          );
          return;
        }

        for (const [rawAttr, rawValue] of Object.entries(attribs)) {
          const attr = rawAttr.toLowerCase();
          if (attr.startsWith('on')) {
            reject(
              `Inline event handler "${rawAttr}" on <${tag}> is not allowed. Put the handler inside a <script> instead.`,
            );
            return;
          }
          if (URL_ATTRIBUTES.has(attr) && DANGEROUS_SCHEME.test(rawValue)) {
            reject(
              `"${rawAttr}" on <${tag}> uses an executable URL scheme, which is not allowed.`,
            );
            return;
          }
        }

        if (tag === 'noscript') noscriptDepth += 1;
        // Remembered so ontext knows whether the body it is about to see is
        // classic JavaScript worth syntax-checking.
        if (tag === 'script' && noscriptDepth === 0) {
          scriptType = (attribs.type ?? '').trim().toLowerCase();
          inScript = true;
        }
        open.push(tag);
      },

      onclosetag(name, isImplied) {
        const tag = name.toLowerCase();
        if (tag === 'noscript' && noscriptDepth > 0) noscriptDepth -= 1;
        if (tag === 'script') inScript = false;

        // `isImplied` is the whole reason this check works. htmlparser2 closes
        // every still-open element when the input ends, so by the time parsing
        // finishes the stack is empty whether or not the admin actually closed
        // anything - the flag is what distinguishes "</script> was written"
        // from "the parser gave up and closed it". Void elements (<meta>,
        // <link>) also arrive implied, and they are legitimately self-closing,
        // so they are excused.
        if (isImplied && !VOID_TAGS.has(tag)) {
          reject(
            `<${tag}> is never closed. An unclosed tag swallows the rest of the page on every route.`,
          );
        }

        const last = open.lastIndexOf(tag);
        if (last !== -1) open.splice(last, 1);
      },

      ontext(text) {
        if (failure) return;

        if (inScript) {
          const syntax = checkScriptSyntax(text, scriptType);
          if (syntax) reject(syntax);
          inScript = false;
          return;
        }

        if (noscriptDepth > 0 || open.length > 0) return;
        if (text.trim()) {
          reject(
            'Loose text outside a tag is not allowed - it would end the <head> early and detach the rest of the page.',
          );
        }
      },

      onerror(err) {
        reject(`Could not parse the markup: ${err.message}`);
      },
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: true },
  );

  parser.write(value);
  parser.end();

  return failure ?? OK;
}

/**
 * Reject an inline `<script>` whose body is not valid JavaScript. Returns the
 * admin-facing reason, or null when it is fine.
 *
 * This is the ONE thing about the script body that can be checked without
 * pretending to understand what it does. A syntax error is never intentional,
 * and the cost of missing one is severe out of proportion to the mistake: the
 * browser aborts the whole script, so a stray character in a pasted snippet
 * silently kills that vendor's tracking on every page - and an admin who pasted
 * TypeScript, or copied half a snippet, gets no signal at all until someone
 * notices the data stopped.
 *
 * `vm.Script` COMPILES ONLY. It parses the source and throws on a syntax error;
 * it never runs a line of it, so nothing here executes admin input.
 *
 * Deliberately NOT checked: what the code does. See this file's header - there
 * is no rule that separates Hotjar from a skimmer, and `MANAGE_SETTINGS` is the
 * control that matters.
 */
function checkScriptSyntax(body: string, type: string): string | null {
  if (!body.trim()) return null;
  if (!CLASSIC_SCRIPT_TYPES.has(type)) return null;

  try {
    new vm.Script(body);
    return null;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'invalid syntax';
    return `The <script> body is not valid JavaScript: ${detail}. (TypeScript is not JavaScript - types have to be stripped before a browser can run it.)`;
  }
}

/**
 * Split a snippet into its top-level elements for rendering.
 *
 * The public site cannot interpolate the raw string: a `<head>` has nowhere to
 * put a wrapper element, and rendering a closed set of known tags is a stronger
 * guarantee than trusting a blob. So the parse that already happens for
 * validation is reused to hand the frontend structure instead.
 *
 * Assumes the value passed `checkCustomScripts` - anything not in `ROOT_TAGS`
 * is dropped rather than reported, because by this point it should be
 * impossible and silently omitting one bad node beats 500ing the whole page.
 * That makes this the last line of the defence-in-depth chain: even a row
 * written straight into the database can only ever render as one of five tags.
 *
 * Inner content is preserved byte for byte (that is the script body). Only the
 * whitespace and comments BETWEEN top-level tags are dropped.
 */
export function parseCustomScript(value: string): CustomScriptNode[] {
  const nodes: CustomScriptNode[] = [];
  let depth = 0;
  let current: CustomScriptNode | null = null;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        if (depth === 0) {
          if (!ROOT_TAGS.has(tag)) return; // unreachable after validation
          current = {
            tag,
            attributes: { ...attribs },
            html: VOID_TAGS.has(tag) ? null : '',
          };
          nodes.push(current);
          depth = 1;
          return;
        }
        // Nested markup (the <iframe> inside a <noscript>) is re-serialised
        // into the parent's inner HTML - it is content, not a node of its own.
        depth += 1;
        if (current)
          current.html = (current.html ?? '') + serialise(tag, attribs);
      },

      ontext(text) {
        if (depth > 0 && current && current.html !== null) {
          current.html += text;
        }
      },

      onclosetag(name, isImplied) {
        const tag = name.toLowerCase();
        if (depth > 1) {
          depth -= 1;
          if (current && !isImplied && !VOID_TAGS.has(tag)) {
            current.html = (current.html ?? '') + `</${tag}>`;
          }
          return;
        }
        if (depth === 1) {
          depth = 0;
          current = null;
        }
      },
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: true },
  );

  parser.write(value);
  parser.end();

  return nodes;
}

/** Re-serialise a nested open tag, escaping attribute values. */
function serialise(tag: string, attribs: Record<string, string>): string {
  const attrs = Object.entries(attribs)
    .map(([key, val]) => ` ${key}="${escapeAttribute(val)}"`)
    .join('');
  return `<${tag}${attrs}>`;
}

/**
 * Escape what would otherwise close the attribute or the tag. The value has
 * already passed the allowlist (no `javascript:`, no `on*` attribute names), so
 * this is about keeping re-serialisation faithful rather than about sanitising.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
