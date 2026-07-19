export { passwordResetTemplate } from './password-reset.template';
export { operatorInviteTemplate } from './operator-invite.template';
export {
  staffInviteTemplate,
  type StaffInviteTemplateProps,
} from './staff-invite.template';
export { emailVerificationTemplate } from './email-verification.template';

// The booking confirmation is NOT a TS template function: it is the design-owned
// `booking-confirmation-email.template.html` (master 6.5 + its locked wireframe),
// rendered by `email-template.renderer.ts` and sent from `mail.service.ts`. The old
// lean `booking-confirmation.template.ts` it replaced was deleted on 2026-07-16.
