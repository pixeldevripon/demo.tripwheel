import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

/**
 * The two halves of the tour approval workflow (access-roles conflict #1:
 * publishing is always Island Tours').
 *
 * Both are one-decision emails, so both ride the shared auth shell rather than
 * inventing layout: the operator's mailbox already knows this shape from the
 * invite and hat-added mails.
 *
 * Every interpolated value is escaped. A tour name is operator-authored and the
 * review note is admin-authored free text - the shell's `paragraphs` accept
 * inline markup by contract, so escaping is this file's job, not the shell's.
 */

export interface TourSubmittedForReviewTemplateProps {
  tourName: string;
  /** Operator company name, else the owner's name. */
  operatorName: string;
  destinationName: string;
  /** Dashboard link straight to the tour's review screen. */
  reviewUrl: string;
  siteLogoUrl?: string | null;
}

/**
 * To Island Tours, when an operator submits a tour. The queue is the system of
 * record - this exists so nobody has to watch it.
 */
export function tourSubmittedForReviewTemplate({
  tourName,
  operatorName,
  destinationName,
  reviewUrl,
  siteLogoUrl,
}: TourSubmittedForReviewTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'A tour is waiting for review.',
    greeting: 'Hello,',
    paragraphs: [
      `<span style="${EMAIL_EMPHASIS}">${escapeHtml(operatorName)}</span> submitted <span style="${EMAIL_EMPHASIS}">${escapeHtml(tourName)}</span> in ${escapeHtml(destinationName)} for review.`,
      'It has already passed the readiness bar - photos, hero, overview, highlights and price are all in place. What is left is the editorial call: approve it to publish, or request changes with a note the operator can act on.',
    ],
    ctaLabel: 'Review this tour',
    ctaUrl: reviewUrl,
    footnote:
      'The tour stays a draft and is invisible to travellers until Island Tours publishes it.',
  });
}

export interface TourApprovedTemplateProps {
  tourName: string;
  /** Optional admin note - approval can carry one, unlike rejection. */
  note?: string;
  /** Dashboard link to the tour. */
  tourUrl: string;
  siteLogoUrl?: string | null;
  /** Operator contact name, when known. */
  name?: string;
}

/**
 * To the operator, when Island Tours approves the tour.
 *
 * APPROVED is not LIVE. Publishing is a separate admin action, so this must not
 * congratulate anyone on a page that does not exist yet - the operator would go
 * looking for it, find nothing, and write in. It says approved, and says who
 * acts next.
 */
export function tourApprovedTemplate({
  tourName,
  note,
  tourUrl,
  siteLogoUrl,
  name,
}: TourApprovedTemplateProps) {
  const paragraphs = [
    `Island Tours reviewed <span style="${EMAIL_EMPHASIS}">${escapeHtml(tourName)}</span> and approved it.`,
    'It goes live when we publish it, which is usually the same day. Nothing more is needed from you - we will take it from here.',
  ];
  if (note?.trim()) {
    paragraphs.push(
      `<span style="${EMAIL_EMPHASIS}">A note from the reviewer</span>`,
      `<span style="display:block;border-left:3px solid #E5E7EB;padding-left:14px;color:#4B5563">${escapeHtml(note.trim()).replace(/\r?\n/g, '<br> ')}</span>`,
    );
  }
  return authEmailShell({
    siteLogoUrl,
    title: 'Your tour is approved.',
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs,
    ctaLabel: 'Open your tour',
    ctaUrl: tourUrl,
    footnote:
      'Editing an approved tour is fine - operational fields like pricing and cutoffs apply straight away.',
  });
}

export interface TourChangesRequestedTemplateProps {
  tourName: string;
  /** The admin's note - required on reject, and the whole point of this email. */
  note: string;
  /** Dashboard link straight to the tour's review screen. */
  editUrl: string;
  siteLogoUrl?: string | null;
  /** Operator contact name, when known. */
  name?: string;
}

/**
 * To the operator, when Island Tours requests changes.
 *
 * The note is the payload, but it does NOT go in the shell's `code` slot: that
 * is 36px with .14em tracking, sized for a six-digit code, and a two-sentence
 * note set that way wraps into a wall. It gets its own paragraph instead, with
 * a rule down the left so it reads as quoted rather than as our copy. Line
 * breaks the admin typed are preserved - a note is often a list.
 */
export function tourChangesRequestedTemplate({
  tourName,
  note,
  editUrl,
  siteLogoUrl,
  name,
}: TourChangesRequestedTemplateProps) {
  // `<br> ` with the trailing space, not a bare `<br>`: the shell builds its
  // plain-text part by stripping tags, so a bare one would run "line one" and
  // "line two" together into a single word.
  const quotedNote = escapeHtml(note.trim()).replace(/\r?\n/g, '<br> ');
  return authEmailShell({
    siteLogoUrl,
    title: 'Changes requested on your tour.',
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      `Island Tours reviewed <span style="${EMAIL_EMPHASIS}">${escapeHtml(tourName)}</span> and would like some changes before it goes live.`,
      `<span style="${EMAIL_EMPHASIS}">What to change</span>`,
      `<span style="display:block;border-left:3px solid #E5E7EB;padding-left:14px;color:#4B5563">${quotedNote}</span>`,
    ],
    ctaLabel: 'Open your tour',
    ctaUrl: editUrl,
    footnote:
      'Make the changes and submit it again - there is no limit on resubmissions.',
  });
}
