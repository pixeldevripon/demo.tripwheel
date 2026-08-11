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
  tourSubmittedSalesSubject,
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
// ── WP-D: the onboarding drip (OB-2…OB-8 + INT1R), wireframe copy locked ─────
export {
  OPERATOR_WELCOME_AGREEMENT_SUBJECT,
  operatorWelcomeAgreementTemplate,
  type OperatorWelcomeAgreementTemplateProps,
} from './operator-welcome-agreement.template';
export {
  OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
  operatorFirstTourHowtoTemplate,
  type OperatorFirstTourHowtoTemplateProps,
} from './operator-first-tour-howto.template';
export {
  OPERATOR_BUILD_WITH_YOU_SUBJECT,
  operatorBuildWithYouTemplate,
  type OperatorBuildWithYouTemplateProps,
} from './operator-build-with-you.template';
export {
  operatorTourLiveSubject,
  operatorTourLiveTemplate,
  type OperatorTourLiveTemplateProps,
} from './operator-tour-live.template';
export {
  OPERATOR_CHECK_IN_SUBJECT,
  operatorCheckInTemplate,
  type OperatorCheckInTemplateProps,
} from './operator-check-in.template';
export {
  OPERATOR_CONNECT_CALENDAR_SUBJECT,
  operatorConnectCalendarTemplate,
  type OperatorConnectCalendarTemplateProps,
} from './operator-connect-calendar.template';
export {
  OPERATOR_PAGE_STRONGER_SUBJECT,
  operatorPageStrongerTemplate,
  type OperatorPageStrongerTemplateProps,
} from './operator-page-stronger.template';
export {
  operatorPendingReminderSubject,
  operatorPendingReminderTemplate,
  type OperatorPendingReminderTemplateProps,
} from './operator-pending-reminder.template';

// The booking confirmation is NOT a TS template function: it is the design-owned
// `booking-confirmation-email.template.html` (master 6.5 + its locked wireframe),
// rendered by `email-template.renderer.ts` and sent from `mail.service.ts`. The old
// lean `booking-confirmation.template.ts` it replaced was deleted on 2026-07-16.
