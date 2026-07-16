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

/** Values a template may reference. `null`/`undefined` render as empty + falsy. */
export type EmailTemplateContext = Record<
  string,
  string | number | boolean | null | undefined
>;

const IF_OPEN = '[IF ';
const IF_CLOSE = '[/IF]';
const ELSE_TAG = '[ELSE]';

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
  return substitute(resolveConditionals(template, ctx), ctx);
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
  for (const [, key] of template.matchAll(TOKEN_RE)) {
    if (!(key in ctx)) missing.add(key);
  }
  return [...missing];
}

// ── internals ───────────────────────────────────────────────────────────────

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

/** Empty string, null/undefined, false and 0 are all falsy for `[IF flag]`. */
function truthy(value: EmailTemplateContext[string]): boolean {
  if (value == null || value === false) return false;
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
    return value == null ? '' : escapeHtml(String(value));
  });
}

/** Escape for HTML text/attribute context (templates interpolate into both). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
