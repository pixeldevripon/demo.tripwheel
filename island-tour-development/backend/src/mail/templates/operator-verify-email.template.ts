import { operatorEmailShell } from './operator-email-shell';

/**
 * OB-1 "Confirm your email" — the operator-family address verification.
 * Copy is LOCKED by the onboarding wireframe (stage m1).
 *
 * This is deliberately NOT a variant of `email-verification.template.ts`. That
 * template belongs to the traveller/account design family and is sent to
 * customers, staff and email-change flows; the two families share nothing but
 * a purpose. Better Auth's verification hook picks between them by role.
 *
 * Single purpose, per the wireframe's trigger note: nothing else may ride
 * along in a verification email — no dashboard tour, no onboarding nudge.
 */

export interface OperatorVerifyEmailTemplateProps {
  /** Better Auth's signed verification URL. */
  verifyUrl: string;
}

export const OPERATOR_VERIFY_EMAIL_SUBJECT = 'Confirm your email';

export function operatorVerifyEmailTemplate({
  verifyUrl,
}: OperatorVerifyEmailTemplateProps) {
  return operatorEmailShell({
    title: OPERATOR_VERIFY_EMAIL_SUBJECT,
    preheader: "One click and you're through to the next step.",
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: OPERATOR_VERIFY_EMAIL_SUBJECT },
      {
        kind: 'paragraph',
        html: "Your operator account is almost ready. One click and you're through.",
      },
      { kind: 'button', label: 'Confirm my email', url: verifyUrl },
      {
        kind: 'muted',
        // The 24-hour statement is the wireframe's, locked copy — and it is
        // TRUE: `emailVerification.expiresIn` in auth.instance.ts is set to
        // 60 * 60 * 24 to match it (founder decision 2026-08-12). Change one
        // and you must change the other; a link that dies before the sentence
        // promises is the bug this pair exists to prevent.
        html: "The link works for 24 hours. Didn't sign up? You can ignore this email.",
      },
    ],
    // Verification carries sender identity only: no sign-off, no opt-out.
    footer: { variant: 'verification' },
  });
}
