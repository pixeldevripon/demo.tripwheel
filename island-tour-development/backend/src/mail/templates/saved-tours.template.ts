import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

/** One saved tour, as the email needs to draw it. */
export interface SavedTourCard {
  title: string;
  /** Flat tour URL. Null when the tour has no destination and so no page. */
  url: string | null;
  imageUrl: string | null;
  /** Display "from" price, already converted. Null hides the price line. */
  price: number | null;
  currency: string;
  durationMinutes: number | null;
  /** Null when the tour has no reviews yet - the row is omitted, not zeroed. */
  rating: number | null;
  reviewCount: number;
}

export interface SavedToursTemplateProps {
  /** Link back to the saved list, carrying the ids so it restores anywhere. */
  listUrl: string;
  /** Locale, for number and price formatting. */
  locale: string;
  tours: SavedTourCard[];
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * How many cards the email draws before it stops naming them.
 *
 * A saved list is a shortlist; past a dozen the email stops being a reminder
 * and becomes a catalogue, and the CTA - the only thing that matters here -
 * gets pushed below the fold in every client.
 */
const MAX_LISTED = 12;

/** Palette, matching the booking family's inline styles exactly. */
const INK = '#1F2937';
const SOFT = '#6B7280';
const RULE = '#E5E7EB';
const CTA = '#E8611A';
const AMBER = '#E5A230';

function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code should cost the price line, not the email.
    return `${amount}`;
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/**
 * One tour as an email card: thumbnail left, name and meta right.
 *
 * Built from a table with inline styles rather than flex or grid, because
 * Outlook renders neither. The whole card is wrapped in the anchor so the
 * thumbnail is part of the tap target - on a phone that is most of the row.
 */
function card(tour: SavedTourCard, locale: string): string {
  const meta = [
    tour.rating !== null
      ? `<span style="color:${AMBER};font-weight:700">&#9733; ${tour.rating}</span>` +
        ` <span style="color:${SOFT}">(${tour.reviewCount})</span>`
      : '',
    tour.durationMinutes ? formatDuration(tour.durationMinutes) : '',
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const price =
    tour.price !== null
      ? `<div style="font-size:13px;color:${SOFT};margin-top:5px">from <span style="${EMAIL_EMPHASIS};font-size:15px">${escapeHtml(
          formatPrice(tour.price, tour.currency, locale),
        )}</span></div>`
      : '';

  const thumb = tour.imageUrl
    ? `<img src="${escapeHtml(tour.imageUrl)}" width="88" height="88" alt="" style="display:block;width:88px;height:88px;object-fit:cover;border-radius:9px;background:#F3F4F6;border:0">`
    : `<div style="width:88px;height:88px;border-radius:9px;background:#F3F4F6"></div>`;

  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
      <tr>
        <td width="88" valign="top" style="width:88px;padding-right:14px">${thumb}</td>
        <td valign="top" style="font-family:'Plus Jakarta Sans',Arial,sans-serif">
          <div style="font-size:15px;font-weight:600;color:${INK};line-height:1.35">${escapeHtml(
            tour.title,
          )}</div>
          ${meta ? `<div style="font-size:13px;color:${SOFT};margin-top:4px">${meta}</div>` : ''}
          ${price}
        </td>
      </tr>
    </table>`;

  // No link when the tour has no page: a dead anchor is worse than plain text.
  const linked = tour.url
    ? `<a href="${escapeHtml(tour.url)}" style="text-decoration:none;color:${INK};display:block">${body}</a>`
    : body;

  return `<tr><td style="padding:16px 0;border-bottom:1px solid ${RULE}">${linked}</td></tr>`;
}

/**
 * "Email me this list" (mck-17, saved tours page).
 *
 * The only pre-booking email the platform sends, and the thing that makes a
 * device-local list work on a second device. On the AUTH shell rather than the
 * booking one: nothing has been booked, and this is a link back to something
 * the traveller owns - the same family as a sign-in link, not a confirmation.
 *
 * The tours are drawn as CARDS, each linking to its own page, rather than
 * listed as names. A list of names is a receipt; a list of cards is the thing
 * the traveller was actually looking at, and it lets them go straight back to
 * the one tour they were thinking about instead of through the list page.
 */
export function savedToursTemplate({
  listUrl,
  locale,
  tours,
  siteLogoUrl,
}: SavedToursTemplateProps) {
  const listed = tours.slice(0, MAX_LISTED);
  const remainder = tours.length - listed.length;

  const cards = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:4px">
      ${listed.map((t) => card(t, locale)).join('\n      ')}
    </table>${
      remainder > 0
        ? `<div style="font-size:13px;color:${SOFT};margin-top:14px">and ${remainder} more on your list</div>`
        : ''
    }`;

  const { html, text } = authEmailShell({
    siteLogoUrl,
    title: 'Your saved tours.',
    paragraphs: [
      'Here is the list you put together. Open it on any device and pick up where you left off.',
      cards,
    ],
    ctaLabel: 'Open my saved tours',
    ctaUrl: listUrl,
    footnote:
      'You asked us to send this list, so this is the only email it triggers. We have not signed you up for anything.',
  });

  // The shell derives its plain-text part by stripping tags, which turns a
  // table of cards into one run-on line. Rebuild that section as a real list,
  // so the text/plain alternative is readable on its own.
  const textList = listed
    .map((t) => (t.url ? `- ${t.title}\n  ${t.url}` : `- ${t.title}`))
    .join('\n');
  const plain = [
    'Your saved tours.',
    '',
    'Here is the list you put together. Open it on any device and pick up where you left off.',
    '',
    textList,
    remainder > 0 ? `\nand ${remainder} more on your list` : '',
    '',
    `Open my saved tours: ${listUrl}`,
    '',
    'You asked us to send this list, so this is the only email it triggers. We have not signed you up for anything.',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { html, text: plain || text };
}
