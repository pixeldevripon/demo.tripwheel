/**
 * Renderer for the LOCKED email templates (`*.template.html`).
 *
 * Those files are design-owned: they ship a tiny placeholder language rather than
 * JSX/Handlebars, so a designer can edit them without touching TypeScript. This is
 * the only thing that understands that language.
 *
 *   {token}                    -> substituted from the context, HTML-escaped
 *   [IF cond]…[/IF]            -> conditional block
 *   [IF cond]…[ELSE]…[/IF]     -> conditional with an alternative
 *   [EACH list]…{item}…[/EACH] -> repeat the body once per array entry
 *
 * `[EACH]` exists so repeated markup (the what-to-bring bullets) stays in the
 * design-owned template instead of being assembled in TypeScript. An empty or
 * missing list renders nothing, so the surrounding heading can be gated with
 * `[IF list]`.
 *
 * Blocks may nest (the booking confirmation nests two deep). Conditions support:
 *
 *   [IF hasPickup]                                    truthy check
 *   [IF paymentModel = on_arrival]                    equality
 *   [IF paymentModel = operator_link OR on_arrival]   equals any (field named once)
 *   [IF paymentModel = on_arrival AND onArrivalPayment = card_or_cash]
 *
 * `AND` binds loosest, so `a = x AND b = y OR z` reads as `(a = x) AND (b = y OR z)`.
 */

/**
 * Values a template may reference. `null`/`undefined` render as empty + falsy.
 * A `string[]` is a list for `[EACH]`; it is truthy for `[IF]` only when non-empty,
 * so a heading above an empty list can be hidden with the same condition.
 */
export type EmailTemplateContext = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

const IF_OPEN = '[IF ';
const IF_CLOSE = '[/IF]';
const ELSE_TAG = '[ELSE]';
const EACH_OPEN = '[EACH ';
const EACH_CLOSE = '[/EACH]';
/** The current entry inside an `[EACH]` body. */
const ITEM_TOKEN = /\{item\}/g;

/** `{token}` - a leading letter, then letters/digits/underscore/dot. */
const TOKEN_RE = /\{([a-zA-Z][a-zA-Z0-9_.]*)\}/g;

/**
 * Render a locked template against `ctx`.
 *
 * Conditionals resolve first, so tokens inside a branch that was dropped are never
 * substituted. Throws on a malformed/unclosed block rather than silently emitting a
 * half-rendered email.
 */
export function renderEmailTemplate(
  template: string,
  ctx: EmailTemplateContext,
): string {
  // Loops expand BEFORE conditionals so an [EACH] body may contain [IF], and
  // before substitution so {item} is resolved per entry rather than globally.
  return substitute(resolveConditionals(resolveLoops(template, ctx), ctx), ctx);
}

/**
 * Tokens the template references but `ctx` does not provide. Unknown tokens are left
 * literal by `substitute` (so they surface loudly instead of blanking a sentence);
 * this is the hook that lets a test or a dev build assert none remain.
 */
export function findUnresolvedTokens(
  template: string,
  ctx: EmailTemplateContext,
): string[] {
  const missing = new Set<string>();
  // Expand loops first: `{item}` only exists inside an [EACH] body and is supplied
  // by the loop, not the context, so scanning the raw template would report it as
  // missing on every render.
  for (const [, key] of resolveLoops(template, ctx).matchAll(TOKEN_RE)) {
    if (!(key in ctx)) missing.add(key);
  }
  return [...missing];
}

// ── internals ───────────────────────────────────────────────────────────────

/**
 * Expand `[EACH list]body[/EACH]`, replacing `{item}` in the body per entry.
 *
 * Loops do not nest (nothing in the design needs it) - an inner `[EACH` would be
 * matched by the first `[/EACH]`, so this throws instead of emitting silent
 * nonsense. Values are escaped by the final `substitute` pass, not here.
 */
function resolveLoops(src: string, ctx: EmailTemplateContext): string {
  let out = '';
  let cursor = 0;

  for (;;) {
    const start = src.indexOf(EACH_OPEN, cursor);
    if (start === -1) return out + src.slice(cursor);
    out += src.slice(cursor, start);

    const nameEnd = src.indexOf(']', start);
    if (nameEnd === -1) throw new Error('Malformed [EACH: no closing "]"');
    const name = src.slice(start + EACH_OPEN.length, nameEnd).trim();

    const bodyStart = nameEnd + 1;
    const closeAt = src.indexOf(EACH_CLOSE, bodyStart);
    if (closeAt === -1) throw new Error(`Unclosed [EACH ${name}]`);
    const body = src.slice(bodyStart, closeAt);
    if (body.includes(EACH_OPEN)) {
      throw new Error(`Nested [EACH] is not supported (in "${name}")`);
    }

    const value = ctx[name];
    const items = Array.isArray(value) ? value : [];
    for (const item of items) {
      out += body.replace(ITEM_TOKEN, escapeHtml(String(item)));
    }
    cursor = closeAt + EACH_CLOSE.length;
  }
}

function resolveConditionals(src: string, ctx: EmailTemplateContext): string {
  let out = '';
  let cursor = 0;

  for (;;) {
    const start = src.indexOf(IF_OPEN, cursor);
    if (start === -1) return out + src.slice(cursor);

    out += src.slice(cursor, start);

    const condEnd = src.indexOf(']', start);
    if (condEnd === -1) throw new Error('Malformed [IF: no closing "]"');
    const condition = src.slice(start + IF_OPEN.length, condEnd);

    const { elseAt, closeAt } = matchBlock(src, condEnd + 1, condition);
    const bodyEnd = elseAt === -1 ? closeAt : elseAt;
    const thenPart = src.slice(condEnd + 1, bodyEnd);
    const elsePart =
      elseAt === -1 ? '' : src.slice(elseAt + ELSE_TAG.length, closeAt);

    const taken = evaluate(condition, ctx) ? thenPart : elsePart;
    // Recurse: the taken branch may itself contain nested blocks.
    out += resolveConditionals(taken, ctx);
    cursor = closeAt + IF_CLOSE.length;
  }
}

/**
 * Locate this block's own `[ELSE]` and `[/IF]`, skipping over nested blocks.
 * `from` is the index just past the opening tag.
 */
function matchBlock(
  src: string,
  from: number,
  condition: string,
): { elseAt: number; closeAt: number } {
  let depth = 1;
  let cursor = from;
  let elseAt = -1;

  while (cursor < src.length) {
    const nextIf = src.indexOf(IF_OPEN, cursor);
    const nextElse = src.indexOf(ELSE_TAG, cursor);
    const nextClose = src.indexOf(IF_CLOSE, cursor);
    if (nextClose === -1) break;

    const next = Math.min(
      ...[nextIf, nextElse, nextClose].filter((i) => i !== -1),
    );

    if (next === nextIf) {
      depth++;
      cursor = nextIf + IF_OPEN.length;
    } else if (next === nextElse) {
      // Only the [ELSE] belonging to THIS block counts; nested ones are skipped.
      if (depth === 1 && elseAt === -1) elseAt = nextElse;
      cursor = nextElse + ELSE_TAG.length;
    } else {
      depth--;
      if (depth === 0) return { elseAt, closeAt: nextClose };
      cursor = nextClose + IF_CLOSE.length;
    }
  }

  throw new Error(`Unclosed [IF ${condition}]`);
}

function evaluate(condition: string, ctx: EmailTemplateContext): boolean {
  const trimmed = condition.trim();

  // AND binds loosest - split it first.
  if (trimmed.includes(' AND ')) {
    return trimmed.split(' AND ').every((part) => evaluate(part, ctx));
  }

  const eq = trimmed.indexOf('=');
  if (eq === -1) return truthy(ctx[trimmed]);

  const field = trimmed.slice(0, eq).trim();
  // `field = a OR b` names the field once, then lists the accepted values.
  const accepted = trimmed
    .slice(eq + 1)
    .split(' OR ')
    .map((v) => v.trim());
  const actual = ctx[field];

  return accepted.some((value) => String(actual ?? '') === value);
}

/** Empty string, null/undefined, false, 0 and an EMPTY LIST are falsy for `[IF flag]`. */
function truthy(value: EmailTemplateContext[string]): boolean {
  if (value == null || value === false) return false;
  // An empty list must be falsy so `[IF whatToBring]` hides its heading.
  if (Array.isArray(value)) return value.length > 0;
  const text = String(value);
  return text !== '' && text !== '0';
}

/**
 * Unknown tokens are left LITERAL on purpose: a stray `{whatToBring}` in a test or a
 * preview is a loud bug, whereas silently blanking it produces a sentence that reads
 * fine and is wrong. `findUnresolvedTokens` is the guard.
 */
function substitute(src: string, ctx: EmailTemplateContext): string {
  return src.replace(TOKEN_RE, (literal, key: string) => {
    if (!(key in ctx)) return literal;
    const value = ctx[key];
    if (value == null) return '';
    // A list referenced as a plain {token} rather than via [EACH]: join it
    // readably instead of leaking JS's "a,b" Array.toString.
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    return escapeHtml(text);
  });
}

/** Escape for HTML text/attribute context (templates interpolate into both). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
