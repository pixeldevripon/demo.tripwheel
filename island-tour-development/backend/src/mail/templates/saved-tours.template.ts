import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

export interface SavedToursTemplateProps {
  /** Link back to the saved list, carrying the ids so it restores anywhere. */
  listUrl: string;
  /** Titles of the saved tours, already localized. */
  tourTitles: string[];
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * How many titles the email prints before it stops naming them.
 *
 * A list is a shortlist; past a dozen names the email stops being a reminder
 * and becomes a catalogue, and the CTA - the only thing that matters here -
 * gets pushed below the fold in every client.
 */
const MAX_LISTED = 12;

/**
 * "Email me this list" (mck-17, saved tours page).
 *
 * The only pre-booking email the platform sends, and the thing that makes a
 * device-local list work on a second device. On the AUTH shell rather than the
 * booking one: nothing has been booked, and this is a link back to something
 * the traveller owns - the same family as a sign-in link, not a confirmation.
 *
 * The titles are printed, not just counted. A link labelled "your 5 saved
 * tours" is indistinguishable from marketing in an inbox two weeks later; the
 * names are what make it recognisably the traveller's own list.
 */
export function savedToursTemplate({
  listUrl,
  tourTitles,
  siteLogoUrl,
}: SavedToursTemplateProps) {
  const listed = tourTitles.slice(0, MAX_LISTED);
  const remainder = tourTitles.length - listed.length;

  const titleLines = listed
    .map(
      (title) => `<span style="${EMAIL_EMPHASIS}">${escapeHtml(title)}</span>`,
    )
    .join('<br>');
  const remainderLine = remainder > 0 ? `<br>and ${remainder} more` : '';

  return authEmailShell({
    siteLogoUrl,
    title: 'Your saved tours.',
    paragraphs: [
      'Here is the list you put together. Open it on any device and pick up where you left off.',
      `${titleLines}${remainderLine}`,
    ],
    ctaLabel: 'Open my saved tours',
    ctaUrl: listUrl,
    footnote:
      'You asked us to send this list, so this is the only email it triggers. We have not signed you up for anything.',
  });
}
