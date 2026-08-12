import { escapeHtml, stripToText } from './email-text.util';

/**
 * The OPERATOR email shell — a wireframe-fidelity rebuild of
 * `technical-doc/emails/island-tours-operator-onboarding-emails-wireframe.html`
 * (`.canvas > .email`, style block lines 38–64).
 *
 * This is a SECOND shell, deliberately. `auth-email-shell.ts` is a clone of the
 * TRAVELLER design family (booking-notice.template.html) and is correct for the
 * twenty templates that ride it. The two families disagree on every element —
 * card padding, type scale, brand bar, footer, button chrome — so a `family`
 * flag would be a switch statement wearing a shell's clothes. They are separate
 * files instead.
 *
 * ── The layout contract ────────────────────────────────────────────────────
 * The wireframe's eleven stages do NOT share one block order: OB-5 puts its
 * callout AFTER the CTA, OB-8 puts its quiet panel BEFORE it, OB-6 has neither
 * a logo nor a headline, and OB-3 opens with a Loom card. A shell with fixed
 * slots (`paragraphs[]`, then a button, then a footnote) cannot express that,
 * so callers pass an ORDERED `blocks` array and the shell renders exactly what
 * it is given, in the order it is given. Ordering is the caller's decision
 * because it is a per-email design decision.
 *
 * ── Vertical rhythm ────────────────────────────────────────────────────────
 * The wireframe expresses gaps as CSS margins. Word-engine Outlook is unreliable
 * with margins on block elements, so every gap here is a SPACER ROW whose height
 * is computed from the two neighbouring blocks' wireframe margins, reproducing
 * CSS margin-collapsing so the rendered result is pixel-identical to the
 * wireframe in a browser and correct everywhere else. See `gapBetween`.
 *
 * ── Escaping ───────────────────────────────────────────────────────────────
 * Plain-text fields (`text`, `label`) are escaped BY THE SHELL. Fields named
 * `html` carry developer-authored inline markup by contract and are the
 * caller's responsibility — any user data inside them must already be through
 * `escapeHtml`. URLs are escaped too: a stray quote in a config value would
 * otherwise break out of the href attribute.
 */

const FONT = "'Plus Jakarta Sans',Arial,sans-serif";

/** Wireframe `:root` tokens (lines 11–14) plus the card's own border. */
const ORANGE = '#E8611A';
const GREEN = '#16A34A';
const DARK = '#1F2937';
const MID = '#6B7280';
const CARD_BORDER = '#EAE7E1';
const BACKDROP = '#EDEFF2';

/** The three CTA fills the family allows. A literal union, never `string`: the
 * value lands unescaped inside a style attribute, and the type is what keeps a
 * future caller from ever routing user data into it. */
const CTA_BACKGROUND = {
  orange: ORANGE,
  green: GREEN,
  dark: DARK,
} as const;

export type OperatorCtaTone = keyof typeof CTA_BACKGROUND;

/** One row of the INTERNAL family's facts table (wireframe stage mint). */
export interface OperatorFactRow {
  /** Left cell. Escaped by the shell. */
  label: string;
  /** Right cell. May carry markup (INT-2's link cell) — PRE-ESCAPE user data. */
  valueHtml: string;
}

/**
 * Every block the wireframe draws, as a discriminated union. Adding a stage
 * means composing these, never editing the shell.
 */
export type OperatorEmailBlock =
  /** `.e-logo` — the text wordmark. `internal` appends the " · Internal" suffix
   * (INT-1, INT-2). There is no image-logo variant: the wireframe's operator
   * card has no brand bar and no dashboard-managed logo slot. */
  | { kind: 'logo'; variant?: 'brand' | 'internal' }
  /** `.e-h`. `compact` is INT-2's 17px override (wireframe line 371). */
  | { kind: 'headline'; text: string; size?: 'default' | 'compact' }
  /** `.e-p`. `marginBottom` 12 is OB-6's tighter setting, 0 its last line. */
  | { kind: 'paragraph'; html: string; marginBottom?: number }
  /** `.e-btn`. */
  | { kind: 'button'; label: string; url: string; tone?: OperatorCtaTone }
  /** `.e-callout`. `marginTop` 16 is OB-5, where the callout follows the CTA. */
  | { kind: 'callout'; heading: string; bodyHtml: string; marginTop?: number }
  /** `.e-quiet`. `spacing` picks which side carries the 16px gap: 'above' is the
   * wireframe default (`margin:16px 0 0`), 'below' is OB-8's `margin:0 0 16px`
   * — it sits ABOVE the CTA there, so the gap has to move with it. */
  | {
      kind: 'quiet';
      heading: string;
      bodyHtml: string;
      spacing?: 'above' | 'below';
    }
  /** `.loom` — the walkthrough card (OB-3 only). */
  | { kind: 'loom'; url: string; duration: string }
  /** `.e-sec`. OB-4 stacks two with 6px and 8px tops instead of the 14px default. */
  | { kind: 'secondary'; label: string; url: string; marginTop?: number }
  /** `.e-muted`. */
  | { kind: 'muted'; html: string }
  /** The INTERNAL family's facts table (wireframe stage mint). */
  | { kind: 'facts'; rows: OperatorFactRow[] };

/**
 * The FOUR footer shapes the wireframe draws. Not one footer with flags: which
 * lines appear is a property of the email's stream, and the variants disagree
 * about more than the opt-out.
 *
 *   A  Island Tours. Built by Islanders.   (the .signoff line)
 *   B  We'll never ask for your password, codes, or payment by email.
 *   C  Island Tours is a service of ITG B.V. (Island Tours Group) · KvK Curaçao 169950
 *   D  Willemstad, Curaçao · www.island.tours
 *   E  Prefer no setup emails? Opt out here.
 *
 * A and E never co-occur — a sign-off and an unsubscribe are different registers.
 * `lifecycle` carries `optOutUrl` in the type so it cannot be forgotten.
 */
export type OperatorEmailFooter =
  /** OB-1. Lines C, D — identity only; a verification mail says nothing else. */
  | { variant: 'verification' }
  /** OB-2, OB-2A, OB-5. Lines A, B, C, D. */
  | { variant: 'transactional' }
  /** OB-3, OB-4, OB-6, OB-7, OB-8. Lines B, C, D, E. */
  | { variant: 'lifecycle'; optOutUrl: string }
  /** INT-1, INT-2. No footer element at all — internal mail has no audience
   * that needs sender identity or an unsubscribe. */
  | { variant: 'none' };

export interface OperatorEmailShellProps {
  /** `<title>`. The subject line — NOT the headline, and not the preheader. */
  title: string;
  /**
   * The hidden inbox preview line (wireframe `.pre`). Deliberately a separate
   * prop: the old shell reused `title` for the title, the preheader AND the
   * headline, so every email previewed as its own headline and the preview
   * pane earned nothing.
   */
  preheader: string;
  /** Rendered in order. See the layout contract above. */
  blocks: OperatorEmailBlock[];
  footer: OperatorEmailFooter;
}

/**
 * An inline link for the copy inside a `bodyHtml` / `html` field. Exported so
 * the two link treatments the wireframe uses live in ONE place: `dark` is the
 * quiet-panel and muted-line anchor (`#1F2937`/700, wireframe lines 53 and
 * 178), `callout` is the tinted-panel anchor (`#9a4a16`/700, line 49).
 *
 * `label` is escaped; `url` is escaped so a config value carrying a quote
 * cannot break out of the attribute.
 */
export function operatorInlineLink(
  url: string,
  label: string,
  tone: 'dark' | 'callout' = 'dark',
): string {
  const color = tone === 'callout' ? '#9a4a16' : DARK;
  return `<a href="${escapeHtml(url)}" style="color:${color};font-weight:700">${escapeHtml(label)}</a>`;
}

// ── Footer copy ──────────────────────────────────────────────────────────────

const FOOT_SIGNOFF = 'Island Tours. Built by Islanders.';
const FOOT_SECURITY =
  "We'll never ask for your password, codes, or payment by email.";
const FOOT_ENTITY =
  'Island Tours is a service of ITG B.V. (Island Tours Group) · KvK Curaçao 169950';
const FOOT_ADDRESS = 'Willemstad, Curaçao · www.island.tours';

// ── Block geometry ───────────────────────────────────────────────────────────

interface RenderedBlock {
  html: string;
  /** Wireframe margin-top, in px. */
  marginTop: number;
  /** Wireframe margin-bottom, in px. */
  marginBottom: number;
  /**
   * True for `.e-btn`, which is `display:inline-block`. Inline-block margins do
   * NOT collapse against their neighbours, so a button's 10px bottom margin
   * ADDS to whatever follows it — which is why OB-5's CTA-to-callout gap is
   * 26px and not 16px. Getting this wrong is how the current build lost the
   * wireframe's rhythm.
   */
  inlineBlock: boolean;
  /** Lines for the plain-text part. */
  text: string[];
}

/**
 * CSS margin semantics, reproduced. Adjacent block-level siblings collapse to
 * the larger of the two margins; anything touching an inline-block sums.
 */
function gapBetween(previous: RenderedBlock, next: RenderedBlock): number {
  if (previous.inlineBlock || next.inlineBlock) {
    return previous.marginBottom + next.marginTop;
  }
  return Math.max(previous.marginBottom, next.marginTop);
}

/** A vertical gap as a table row. `mso-line-height-rule:exactly` is what stops
 * the Word engine inflating a zero-height cell to a full line box. */
function spacerRow(height: number): string {
  if (height <= 0) return '';
  return `<tr><td height="${height}" style="height:${height}px;font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td></tr>`;
}

function contentRow(html: string): string {
  return `<tr><td style="font-family:${FONT}">${html}</td></tr>`;
}

/** Strips markup and decodes the entities `escapeHtml` introduced, so the
 * plain-text part reads as the operator wrote their own name. */

// ── Block renderers ──────────────────────────────────────────────────────────

function renderBlock(block: OperatorEmailBlock): RenderedBlock {
  switch (block.kind) {
    case 'logo': {
      // The wireframe sets `text-transform:uppercase` on "Island Tours". The
      // literal text is written uppercase as well, so a client that drops the
      // property still renders the wordmark the way the design intends.
      const mark = `ISLAND <span style="color:${ORANGE}">TOURS</span>`;
      const suffix =
        block.variant === 'internal'
          ? ` · <span style="color:${MID};letter-spacing:.05em">INTERNAL</span>`
          : '';
      return {
        html: `<div style="font-family:${FONT};font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${DARK};line-height:1.2">${mark}${suffix}</div>`,
        marginTop: 0,
        marginBottom: 20,
        inlineBlock: false,
        // The wordmark is chrome, not content — it would only be noise at the
        // top of a plain-text part.
        text: [],
      };
    }

    case 'headline': {
      const size = block.size === 'compact' ? '17px' : '21px';
      // `line-height` is not in the wireframe (the browser default applies
      // there); it is stated here because the Word engine's default leading on
      // an 800-weight 21px line is visibly looser than a browser's.
      return {
        html: `<div style="font-family:${FONT};font-size:${size};font-weight:800;letter-spacing:-.01em;line-height:1.25;color:${DARK}">${escapeHtml(block.text)}</div>`,
        marginTop: 0,
        marginBottom: 10,
        inlineBlock: false,
        text: [block.text, '-'.repeat(block.text.length)],
      };
    }

    case 'paragraph':
      return {
        // A `<div>`, not a `<p>`: every client applies its own `<p>` margins,
        // and the spacer rows already own the rhythm.
        html: `<div style="font-family:${FONT};font-size:14.5px;font-weight:400;line-height:1.6;color:#374151">${block.html}</div>`,
        marginTop: 0,
        marginBottom: block.marginBottom ?? 16,
        inlineBlock: false,
        text: [stripToText(block.html)],
      };

    case 'button': {
      const background = CTA_BACKGROUND[block.tone ?? 'orange'];
      const url = escapeHtml(block.url);
      // The wireframe's `.e-btn` is an inline-block `<a>` with its own padding.
      // Outlook's Word engine drops padding on an inline anchor, collapsing the
      // button to bare underlined text — so the padding moves onto a `<td>` and
      // the fill is declared twice (bgcolor for the Word engine, background for
      // everyone else). `border-radius` degrades to square corners there, which
      // is accepted.
      return {
        html:
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>` +
          `<td bgcolor="${background}" style="background:${background};border-radius:10px;padding:13px 22px">` +
          `<a href="${url}" style="font-family:${FONT};font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none;display:inline-block;line-height:1">${escapeHtml(block.label)}</a>` +
          `</td></tr></table>`,
        marginTop: 0,
        marginBottom: 10,
        inlineBlock: true,
        text: [`${block.label}: ${block.url}`],
      };
    }

    case 'callout':
      // `border-left:4px solid` is dropped wholesale by the Word engine (it
      // does not do one-sided borders), and the orange rule IS the callout's
      // identity — so it becomes a real 4px-wide table cell with a bgcolor.
      // The content cell keeps the wireframe's 15px/17px padding, which
      // measures from the rule exactly as the CSS border did.
      return {
        html:
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-radius:10px"><tr>` +
          `<td width="4" bgcolor="${ORANGE}" style="width:4px;background:${ORANGE};font-size:0;line-height:0;border-radius:10px 0 0 10px">&nbsp;</td>` +
          // The tint is declared on the CELL, not only the table: the Word
          // engine ignores a table-level background but honours a td bgcolor.
          `<td bgcolor="#FBF1EA" style="background:#FBF1EA;padding:15px 17px;font-family:${FONT};border-radius:0 10px 10px 0">` +
          `<div style="font-size:14px;font-weight:800;color:#9a4a16;line-height:1.35">${escapeHtml(block.heading)}</div>` +
          spacer(6) +
          `<div style="font-size:14px;color:#5b3a22;line-height:1.55">${block.bodyHtml}</div>` +
          `</td></tr></table>`,
        marginTop: block.marginTop ?? 0,
        marginBottom: 16,
        inlineBlock: false,
        text: [block.heading, stripToText(block.bodyHtml)],
      };

    case 'quiet': {
      const below = block.spacing === 'below';
      return {
        html:
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border:1px solid ${CARD_BORDER};border-radius:10px"><tr>` +
          `<td bgcolor="#F8F8F6" style="background:#F8F8F6;padding:13px 16px;font-family:${FONT}">` +
          `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:${MID};line-height:1.35">${escapeHtml(block.heading)}</div>` +
          spacer(5) +
          `<div style="font-size:13px;color:#4B5563;line-height:1.55">${block.bodyHtml}</div>` +
          `</td></tr></table>`,
        marginTop: below ? 0 : 16,
        marginBottom: below ? 16 : 0,
        inlineBlock: false,
        text: [block.heading, stripToText(block.bodyHtml)],
      };
    }

    case 'loom': {
      const url = escapeHtml(block.url);
      // Wireframe caption: "Watch the walkthrough · {duration}". `duration` is
      // a merge variable, so an unconfigured one drops the separator with it —
      // "Watch the walkthrough · " reads as a bug, not as locked copy.
      const caption = block.duration
        ? `Watch the walkthrough · ${block.duration}`
        : 'Watch the walkthrough';
      // The wireframe thumb is a flex box centring an absolutely-sized chip over
      // a three-stop gradient. Flexbox does not exist in the Word engine and
      // gradients do not exist in several webmail clients, so: a fixed-height
      // cell with `align/valign` doing the centring, the gradient's 60% stop
      // (#1B5E7E) declared as a solid bgcolor UNDERNEATH it, and the play chip
      // as an inline-block whose line-height equals its height. The glyph is
      // &#9658; (BLACK RIGHT-POINTING POINTER), a text character that inherits
      // the orange — never &#9654;&#65039;, which renders as a colour emoji and
      // the wireframe's design constants forbid emoji.
      return {
        html:
          `<a href="${url}" style="display:block;text-decoration:none;color:inherit">` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border:1px solid ${CARD_BORDER};border-radius:12px">` +
          `<tr><td height="150" align="center" valign="middle" bgcolor="#1B5E7E" style="height:150px;background:#1B5E7E;background-image:linear-gradient(150deg,#2E86AB 0%,#1B5E7E 60%,#123F55 100%);border-radius:12px 12px 0 0">` +
          `<span style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:26px;background:#ffffff;color:${ORANGE};font-size:20px;text-align:center">&#9658;</span>` +
          `</td></tr>` +
          `<tr><td style="padding:9px 13px;background:#ffffff;font-family:${FONT};font-size:12.5px;color:${MID};line-height:1.4;border-radius:0 0 12px 12px">${escapeHtml(caption)}</td></tr>` +
          `</table></a>`,
        marginTop: 0,
        marginBottom: 16,
        inlineBlock: false,
        text: [`${caption}: ${block.url}`],
      };
    }

    case 'secondary':
      return {
        html: `<div style="font-family:${FONT};font-size:13.5px;line-height:1.5"><a href="${escapeHtml(block.url)}" style="color:${DARK};font-weight:700;text-decoration:underline;text-underline-offset:2px">${escapeHtml(block.label)}</a></div>`,
        marginTop: block.marginTop ?? 14,
        // 13.5px, not 0: the wireframe's `.e-sec` is a <p> and sets only
        // `margin-top`, so the browser's default `margin-bottom:1em` survives
        // — 1em of 13.5px. Modelling it as 0 stacked OB-4's two secondary
        // lines 8px apart where the wireframe measures 13.5px (headless-
        // Chromium verification 2026-08-12). Everywhere else the next block's
        // larger margin wins the collapse, so this changes only OB-4.
        marginBottom: 13.5,
        inlineBlock: false,
        text: [`${block.label}: ${block.url}`],
      };

    case 'muted':
      return {
        html: `<div style="font-family:${FONT};font-size:12.5px;color:${MID};line-height:1.55">${block.html}</div>`,
        marginTop: 16,
        marginBottom: 0,
        inlineBlock: false,
        text: [stripToText(block.html)],
      };

    case 'facts':
      return {
        html:
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${FONT};font-size:13.5px;color:#374151">` +
          block.rows
            .map(
              (row) =>
                `<tr><td style="padding:4px 0;color:${MID}">${escapeHtml(row.label)}</td>` +
                `<td style="padding:4px 0;text-align:right;font-weight:600">${row.valueHtml}</td></tr>`,
            )
            .join('') +
          `</table>`,
        marginTop: 0,
        marginBottom: 16,
        inlineBlock: false,
        text: block.rows.map(
          (row) => `${row.label}: ${stripToText(row.valueHtml)}`,
        ),
      };
  }
}

/** An in-cell vertical gap (inside a callout or quiet panel, where a spacer ROW
 * is not available because the two lines share one `<td>`). */
function spacer(height: number): string {
  return `<div style="height:${height}px;line-height:${height}px;font-size:0;mso-line-height-rule:exactly">&nbsp;</div>`;
}

// ── Footer ───────────────────────────────────────────────────────────────────

function renderFooter(footer: OperatorEmailFooter): {
  html: string;
  text: string[];
} {
  if (footer.variant === 'none') return { html: '', text: [] };

  const link = (url: string) =>
    `Prefer no setup emails? <a href="${escapeHtml(url)}" style="color:${MID}">Opt out here</a>.`;

  const signoff =
    footer.variant === 'transactional'
      ? // line-height 1.6 inherited from `.e-foot`, not a tighter 1.4: the
        // wireframe's `.signoff` sets no line-height of its own, and 1.4 sat
        // the sign-off 2.4px closer to the security line than designed
        // (headless-Chromium verification 2026-08-12).
        `<div style="font-size:12px;font-weight:800;color:#4B5563;line-height:1.6">${FOOT_SIGNOFF}</div>` +
        spacer(4)
      : '';

  const lines: string[] = [];
  const text: string[] = [];
  if (footer.variant === 'transactional') text.push(FOOT_SIGNOFF);
  if (footer.variant !== 'verification') {
    lines.push(FOOT_SECURITY);
    text.push(FOOT_SECURITY);
  }
  lines.push(FOOT_ENTITY, FOOT_ADDRESS);
  text.push(FOOT_ENTITY, FOOT_ADDRESS);
  if (footer.variant === 'lifecycle') {
    lines.push(link(footer.optOutUrl));
    text.push(`Prefer no setup emails? Opt out here: ${footer.optOutUrl}`);
  }

  return {
    html:
      `<tr><td style="border-top:1px solid ${CARD_BORDER};padding-top:14px;font-family:${FONT};font-size:11.5px;color:${MID};line-height:1.6">` +
      signoff +
      lines.join('<br>') +
      `</td></tr>`,
    text,
  };
}

// ── The shell ────────────────────────────────────────────────────────────────

export function operatorEmailShell({
  title,
  preheader,
  blocks,
  footer,
}: OperatorEmailShellProps): { html: string; text: string } {
  const rendered = blocks.map(renderBlock);

  const rows: string[] = [];
  rendered.forEach((block, index) => {
    if (index > 0) rows.push(spacerRow(gapBetween(rendered[index - 1], block)));
    rows.push(contentRow(block.html));
  });

  const foot = renderFooter(footer);
  if (rendered.length) {
    // The last block still has a bottom margin, and something has to collapse
    // against it. With a footer that is `.e-foot`'s own `margin-top:22px`;
    // WITHOUT one (the internal family) it is the card's padding edge, which
    // collapses against nothing — so the margin survives in full.
    //
    // Modelling the no-footer case as "no spacer" cost INT-1 and INT-2 11px:
    // the wireframe leaves 37px under their CTA (26px card padding + the
    // button's 10px inline-block bottom margin + 1px border) and the build
    // left 26px (headless-Chromium verification 2026-08-12).
    const sentinel = {
      html: '',
      marginTop: foot.html ? 22 : 0,
      marginBottom: 0,
      inlineBlock: false,
      text: [] as string[],
    };
    const gap = gapBetween(rendered[rendered.length - 1], sentinel);
    if (gap > 0) rows.push(spacerRow(gap));
  }
  if (foot.html) rows.push(foot.html);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    /* Lock the palette to the light design: clients that honour color-scheme
       (Apple Mail, iOS) stop inverting the card in dark mode. */
    :root { color-scheme: light; supported-color-schemes: light; }

    @media only screen and (max-width: 480px) {
      .it-op-pad { padding: 16px 10px !important; }
      .it-op-card { padding: 22px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BACKDROP};font-family:${FONT};color:${DARK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}</div>
  <!-- Zero-width padding after the preheader, so the inbox preview shows the
       preheader ALONE instead of running on into the first paragraph. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BACKDROP}">
    <tr><td align="center" class="it-op-pad" style="padding:30px 16px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:14px;border-collapse:separate">
        <!-- ONE uniform padding box (the wireframe's .email rule: padding
             26px 30px), not the per-row padding the auth shell uses; the
             blocks below own their own vertical rhythm. -->
        <tr><td class="it-op-card" style="padding:26px 30px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
            ${rows.filter(Boolean).join('\n            ')}
          </table>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const body = rendered
    .map((block) => block.text.join('\n'))
    .filter(Boolean)
    .join('\n\n');
  const text = [body, ...(foot.text.length ? ['', ...foot.text] : [])].join(
    '\n',
  );

  return { html, text };
}
