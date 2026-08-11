export { passwordResetTemplate } from './password-reset.template';
export { operatorInviteTemplate } from './operator-invite.template';
export {
  staffInviteTemplate,
  type StaffInviteTemplateProps,
} from './staff-invite.template';
export { emailVerificationTemplate } from './email-verification.template';
export { travellerLoginCodeTemplate } from './traveller-login-code.template';
export { savedToursTemplate, type SavedTourCard } from './saved-tours.template';
export { changeEmailConfirmationTemplate } from './change-email-confirmation.template';
export {
  passwordChangeConfirmationTemplate,
  type PasswordChangeConfirmationTemplateProps,
} from './password-change-confirmation.template';
export {
  hatAddedSubject,
  hatAddedTemplate,
  type HatAddedTemplateProps,
} from './hat-added.template';
export {
  tourApprovedTemplate,
  tourChangesRequestedTemplate,
  tourSubmittedForReviewTemplate,
  tourSubmittedSalesTemplate,
  type TourApprovedTemplateProps,
  type TourChangesRequestedTemplateProps,
  type TourSubmittedForReviewTemplateProps,
  type TourSubmittedSalesTemplateProps,
} from './tour-review.template';
export {
  OPERATOR_APPROVED_SUBJECT,
  operatorApprovedTemplate,
  type OperatorApprovedTemplateProps,
} from './operator-approved.template';
export {
  operatorSignupInternalSubject,
  operatorSignupInternalTemplate,
  type OperatorSignupInternalTemplateProps,
} from './operator-signup-internal.template';

// The booking confirmation is NOT a TS template function: it is the design-owned
// `booking-confirmation-email.template.html` (master 6.5 + its locked wireframe),
// rendered by `email-template.renderer.ts` and sent from `mail.service.ts`. The old
// lean `booking-confirmation.template.ts` it replaced was deleted on 2026-07-16.
