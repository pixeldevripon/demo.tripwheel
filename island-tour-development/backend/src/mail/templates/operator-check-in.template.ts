import { escapeHtml } from './auth-email-shell';
import { operatorEmailShell } from './operator-email-shell';

/**
 * OB-6 "How's it going?" - the day-14 founder check-in that formally ENDS the
 * onboarding sequence. Copy is LOCKED by the onboarding wireframe (stage m6):
 * near-plain text, no buttons, no images, and - uniquely in the family - NO
 * LOGO and NO HEADLINE. "Plain personal check-ins earn replies that designed
 * emails do not."
 *
 * It rides the operator shell all the same. The old hand-rolled copy of the
 * card markup drifted from the shell the moment either changed, and the shell
 * already expresses "no logo, no headline" as simply not passing those blocks
 * — which is the whole point of an ordered block list.
 *
 * Reply-To is the founder's monitored inbox (OB6_REPLY_TO, set by the caller
 * on SendMailOptions, never here). The wireframe also asks for a `from` of
 * "Denley from Island Tours"; `SendMailOptions` has no `from` field, so that
 * half of the personalisation is still missing at the CALL SITE, not here.
 *
 * Still a lifecycle email: the footer carries sender identity and the WP-A
 * opt-out link like the rest of the OB nudge set.
 */

export interface OperatorCheckInTemplateProps {
  /** Signatory's first name - "Hi {firstName},". */
  firstName?: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
}

export const OPERATOR_CHECK_IN_SUBJECT = "How's it going?";

export function operatorCheckInTemplate({
  firstName,
  optOutUrl,
}: OperatorCheckInTemplateProps): { html: string; text: string } {
  return operatorEmailShell({
    title: OPERATOR_CHECK_IN_SUBJECT,
    preheader: 'One quick question.',
    blocks: [
      // Wireframe stage m6 tightens every paragraph to a 12px bottom margin and
      // zeroes the last one - a personal note is set closer than a designed
      // email.
      {
        kind: 'paragraph',
        html: firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,',
        marginBottom: 12,
      },
      {
        kind: 'paragraph',
        html: "Denley here, founder of Island Tours. One quick question: what's the one thing we could do better for you as an operator?",
        marginBottom: 12,
      },
      {
        kind: 'paragraph',
        html: "Hit reply, it lands in my inbox. WhatsApp works too, that's often faster.",
        marginBottom: 12,
      },
      { kind: 'paragraph', html: 'Denley', marginBottom: 0 },
    ],
    footer: { variant: 'lifecycle', optOutUrl },
  });
}
