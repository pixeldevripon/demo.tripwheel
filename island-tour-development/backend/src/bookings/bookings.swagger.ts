import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
  PaymentRequiredErrorDto,
  TooManyRequestsErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { EmailSendDto } from '@/mail/dto/email-preferences.dto';
import {
  BookingLookupResponseDto,
  BookingQuoteResponseDto,
  BookingResponseDto,
  ConversionPushResponseDto,
  CustomerBookingSummaryDto,
  OperatorTermsAcceptanceDto,
  UpdateBookingResponseDto,
  ListBookingsResponseDto,
  RecoverReferenceResponseDto,
  RequestCancellationResponseDto,
  WithdrawCancellationResponseDto,
  RequestTravellerCodeResponseDto,
  ResendConfirmationResponseDto,
  ThankYouResponseDto,
  ChangeBookingDateResponseDto,
  DateChangeOptionsResponseDto,
  TravellerBookingsResponseDto,
  TravellerContactDto,
  TravellerPaymentsResponseDto,
  TravellerReceiptDto,
  VerifyTravellerCodeResponseDto,
} from './dto/booking.dto';

export const ApiQuoteDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Quote a booking price (server-authoritative, no side effects)',
      description:
        'Computes totals, deposit/balance split, and the commission snapshot for a prospective ' +
        'booking without claiming seats or persisting anything. Priced in the tour default ' +
        'currency (multi-currency FX is a later phase).',
    }),
    ApiOkResponse({ type: BookingQuoteResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiUnprocessableEntityResponse({
      description: 'Invalid items/guests, party-size, or age restriction.',
    }),
  );

export const ApiReserveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reserve a booking (OCTO step 1)',
      description:
        'Atomic seat claim → ON_HOLD (or CONFIRMED for OPERATOR_FULL). Idempotent by id.',
    }),
    ApiCreatedResponse({ type: BookingResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiUnprocessableEntityResponse({
      description: 'Sold out / restriction / cutoff.',
    }),
  );

export const ApiConfirmDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Confirm a booking (OCTO step 2)',
      description:
        'Requires the amount due at confirmation (deposit, or the full total for ' +
        'PAID_IN_FULL) to already be captured in the payment ledger - 402 otherwise. ' +
        'The Stripe webhook/settle path proves payment via the charge itself.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiResponse({
      status: 402,
      type: PaymentRequiredErrorDto,
      description: 'The amount due at confirmation has not been captured.',
    }),
    ApiUnprocessableEntityResponse({ description: 'Hold expired.' }),
  );

export const ApiCancelDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Cancel a booking (releases seats, computes refund)',
      description:
        'ON_HOLD holds may be released with the booking id alone (checkout-abandon ' +
        'path). Anything past ON_HOLD requires an authenticated ops session: a ' +
        'platform role, or the operator who owns the booking (foreign ids 404). ' +
        'Customers use POST /bookings/:id/cancellation-request instead.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Cancelling past ON_HOLD requires an ops session.',
    }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiRestoreDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Restore a cancelled booking (admin only)',
      description:
        'Reverses a mistaken cancellation: re-takes the seats (guarded - never ' +
        'overbooks resold capacity), returns the booking and its unit items to ' +
        'CONFIRMED, clears every cancellation stamp, reinstates the settlement ' +
        'obligation and re-sends the confirmation email. Refused when a refund ' +
        'already settled or is in flight, when the departure ran or was itself ' +
        'cancelled, when the booking was forfeited, or when the seats were resold.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description:
        'Not restorable: refunded, departed, forfeited, or seats resold.',
    }),
  );

export const ApiReportNonPaymentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Operator reports the OPERATOR_LINK balance was never paid (guide s15)',
      description:
        'Stamps utcNonPaymentReportedAt once (idempotent). Nothing is forfeited ' +
        'until an admin confirms - forfeiture is never automatic. Operator must ' +
        'own the booking (admins may report on their behalf).',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiConfirmForfeitDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Admin confirms a non-payment report: deposit forfeited, spot released',
      description:
        'Terminates the booking as CANCELLED with utcForfeitedAt set. NO refund ' +
        '(the deposit is kept - commission stays earned, settlement is NOT ' +
        'reversed) and the seats return to inventory. Requires a prior report.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiDismissNonPaymentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Admin dismisses a non-payment report (traveler paid after all)',
      description:
        'Clears utcNonPaymentReportedAt so the booking reads CONFIRMED again. ' +
        'Rejected once the booking is already forfeited.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiReportCancellationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Operator reports they must cancel a confirmed booking (conflict #2)',
      description:
        'Stamps utcOperatorCancellationReportedAt once (idempotent) and emails ' +
        'the admin worklist. Operators never execute refunds - an admin either ' +
        'cancels the booking (full refund, cancelledBy OPERATOR so the ' +
        'eligibility metric counts it) or dismisses the report. The settlement ' +
        'payout is held while the report is pending. Operator must own the ' +
        'booking (admins may report on their behalf).',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiDismissCancellationReportDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Admin dismisses an operator cancellation report (tour runs after all)',
      description:
        'Clears utcOperatorCancellationReportedAt + the stored reason so the ' +
        'booking reads CONFIRMED again and the settlement payout hold lifts. ' +
        'Rejected once the booking is already cancelled.',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiExtendDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Extend an on-hold reservation window' }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiAcceptOperatorTermsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Accept the tour's operator conditions (checkout gate)",
      description:
        'Stamps the acceptance evidence pair onto the ON_HOLD booking ' +
        '(timestamp + operator document version; identity is the booking ' +
        'contact - Pastel #80 / MCK-20 §4). Idempotent: a re-tick returns the ' +
        'first stamp. A flagged tour cannot take a payment intent without ' +
        'this. 409 when the tour carries no conditions or the booking has ' +
        'left ON_HOLD.',
    }),
    ApiOkResponse({ type: OperatorTermsAcceptanceDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiUpdateBookingDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update booking contact / notes / pickup',
      description:
        'Contact changes on a CONFIRMED booking require an X-Traveler-Session ' +
        'owning the booking (401 otherwise) - the ON_HOLD checkout contact PATCH ' +
        'needs no session.',
    }),
    ApiOkResponse({ type: UpdateBookingResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description:
        'Contact rewrite on a CONFIRMED booking without an owning traveler session.',
    }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiLookupBookingDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traveller booking lookup (email + booking reference)',
      description:
        'The `/bookings` login surface: verifies the email + display-reference pair and returns ' +
        'the TYP coordinates (`publicRef` + `destinationSlug`). Enumeration-proof - every failed ' +
        'pair returns the same generic 404. Throttled to a human pace.',
    }),
    ApiOkResponse({ type: BookingLookupResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiRecoverReferenceDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "'Lost your reference?' recovery (email in, notice out)",
      description:
        'Always responds `{ sent: true }` whether or not the email has bookings (enumeration-proof). ' +
        'When it does, one branded notice lists the references of up to the five most recent ' +
        'bookings, sent to the stored contact address. Throttled to a human pace.',
    }),
    ApiOkResponse({ type: RecoverReferenceResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

// ── Traveller account area (/{locale}/traveller) ────────────────────────────

export const ApiRequestTravellerCodeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Email a one-time login code for the traveller account area',
      description:
        'Step 1 of the account login. Always responds `{ sent: true }` whether or not the ' +
        'email has bookings (enumeration-proof); when it does, a 6-digit code valid for 10 ' +
        'minutes is mailed to the STORED contact address. Requesting a new code invalidates ' +
        'the previous one. Throttled per IP and capped per target email (1/min, 5/day).',
    }),
    ApiOkResponse({ type: RequestTravellerCodeResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiVerifyTravellerCodeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Redeem a login code for a history-scoped traveler session',
      description:
        'Step 2 of the account login. Returns a 24h HISTORY-scoped session token (proves live ' +
        'inbox ownership, so it unlocks the account surface as well as everything an ' +
        'email-scoped token can do). Single-use code, max 5 attempts (enforced by a ' +
        'conditional write, so concurrent guesses cannot exceed it), and every failure - ' +
        'unknown email, wrong/expired/used code, attempts exhausted - returns the same ' +
        'generic 401. Guessing is bounded per EMAIL as well as per IP: 12 attempts per 15 ' +
        'minutes and 30 per day, charged before the code is even looked up.',
    }),
    ApiOkResponse({ type: VerifyTravellerCodeResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Invalid or expired code (uniform for every failure mode).',
    }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiTooManyRequestsResponse({
      type: TooManyRequestsErrorDto,
      description:
        'Per-IP throttle, or the per-email guess budget (body carries ' +
        "`reason: 'too-many-attempts'`). No code can succeed until it clears.",
    }),
  );

export const ApiTravellerBookingsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Traveller account: the caller's own bookings",
      description:
        'Scoped by the contact email inside the X-Traveler-Session, so it covers guest ' +
        'bookings made before any account existed. Carries the review affordance (self-scoped ' +
        'by definition) but never settlement/payout context, ops timestamps, or commission.',
    }),
    ApiOkResponse({ type: TravellerBookingsResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description:
        'Missing, expired, or non-history session. A `/bookings` pair-login or checkout ' +
        'token is valid but NOT sufficient here - the account area requires the OTP login.',
    }),
  );

export const ApiTravellerContactDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traveller account: checkout contact prefill',
      description:
        "The contact block from the caller's most recent booking, so a returning " +
        'traveller does not retype it at checkout. `email` is always the session ' +
        'email. `hasHistory: false` means no earlier booking - only the email is filled.',
    }),
    ApiOkResponse({ type: TravellerContactDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Missing, expired, or non-history session.',
    }),
  );

export const ApiTravellerSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traveller account: stat row (trips, upcoming, net spend)',
      description:
        'Same live-ledger math as the customer dashboard summary, scoped by the session ' +
        'contact email. Spend is per currency (never summed across currencies).',
    }),
    ApiOkResponse({ type: CustomerBookingSummaryDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Missing, expired, or non-history session.',
    }),
  );

export const ApiTravellerPaymentsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        "Traveller account: every charge and refund on the caller's bookings",
      description:
        'Traveler-safe projection of the payment ledger: no provider intent/charge ids, no ' +
        'settlement or payout context, no contact fields.',
    }),
    ApiOkResponse({ type: TravellerPaymentsResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Missing, expired, or non-history session.',
    }),
  );

export const ApiTravellerReceiptDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traveller account: one payment as a printable receipt',
      description:
        'Receipt payload for the account area (review 9a): the payment, its ' +
        'booking context and the payer name. A receipt, not a tax invoice - ' +
        'no VAT breakdown exists on the platform. Self-scoped by the ' +
        'HISTORY session like every account read.',
    }),
    ApiOkResponse({ type: TravellerReceiptDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'Missing, expired, or non-history session.',
    }),
    ApiNotFoundResponse({
      type: NotFoundErrorDto,
      description: "Unknown payment id, or not this traveller's payment.",
    }),
  );

export const ApiDateChangeOptionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Switchable departures for a self-service date change',
      description:
        'The next OPEN departures of the SAME tour with room for this party ' +
        '(whole unit free for exclusive charters). Session-owned; refuses ' +
        'outside the free-cancellation window (review 10.4).',
    }),
    ApiOkResponse({ type: DateChangeOptionsResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'No owning traveler session.',
    }),
  );

export const ApiChangeBookingDateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Move the booking to another departure (self-service)',
      description:
        'Direct atomic swap inside the free-cancellation window: guarded ' +
        'seat claim on the target departure, release on the old one, time ' +
        'snapshots updated. Prices and commission are untouched. Traveller ' +
        'and operator are notified by email.',
    }),
    ApiOkResponse({ type: ChangeBookingDateResponseDto }),
    ApiUnauthorizedResponse({
      type: UnauthorizedErrorDto,
      description: 'No owning traveler session.',
    }),
  );

export const ApiThankYouDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Thank-you-page payload by publicRef (public TYP token)',
      description:
        'Drives the noindex TYP route. Does NOT carry the `booking_complete` ' +
        'conversion payload (this GET is also the /payment/processing poller, so ' +
        'returning it would double-fire the pixel); the one-time push is served ' +
        'by `POST typ/:publicRef/conversion` instead.',
    }),
    ApiOkResponse({ type: ThankYouResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiClaimConversionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Claim the one-time booking_complete push (public TYP token)',
      description:
        'Mark-first served (master 8.2): the FIRST verified render of a confirmed ' +
        'booking gets the `booking_complete` payload to push to the dataLayer; every ' +
        'later call (refresh, second tab, shared link, unverified, non-confirmed, or ' +
        'null-commission) returns `{ conversion: null }`. Conversion value = ' +
        'commission_amount in EUR (rule #22). Requires the X-Traveler-Session owning ' +
        'the booking. Throttled to 5 per publicRef / minute.',
    }),
    ApiOkResponse({ type: ConversionPushResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiResendConfirmationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend the confirmation email (public TYP token)',
      description:
        'Backs the TYP "Don\'t see it? Check spam, or Resend email" link. Sends only to the ' +
        'contact email stored on the booking - the recipient is never accepted from the caller. ' +
        'Confirmed bookings only. Throttled to 1 per 10s / 3 per min / 10 per hour per IP.',
    }),
    ApiOkResponse({ type: ResendConfirmationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description:
        'Booking is not CONFIRMED, so there is no confirmation to resend',
    }),
    ApiUnprocessableEntityResponse({
      description: 'Booking has no contact email on file.',
    }),
  );

export const ApiRequestCancellationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request cancellation of a booking (public TYP token)',
      description:
        'Backs the tokenized /cancel/{publicRef} form (master 6.4/C1). Never cancels on click: ' +
        'it emails the Island Tours admin, who processes the refund and confirms by email. ' +
        'Confirmed bookings only. Throttled to 1 per 10s / 3 per min / 10 per hour per IP.',
    }),
    ApiOkResponse({ type: RequestCancellationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description: 'Booking is not CONFIRMED, so there is nothing to cancel',
    }),
  );

export const ApiWithdrawCancellationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Withdraw a pending cancellation request (public TYP token)',
      description:
        'Clears the cancellation-request stamp while the request is still pending, ' +
        'so the booking simply stands. Notifies the admin, the traveller and the ' +
        'operator (the exact audience the request notified). Refused once the ' +
        'cancellation was executed - restoring is then an admin action. Requires ' +
        'the owning traveler session, like the request itself.',
    }),
    ApiOkResponse({ type: WithdrawCancellationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description: 'The booking was already cancelled.',
    }),
  );

export const ApiCalendarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Download the booking as an .ics calendar file (public TYP token)',
      description:
        'Backs the confirmation email\'s "Add to calendar" link, so it is opened straight from ' +
        'a mail client with no session. Keyed on the unguessable publicRef and limited to the ' +
        'details the email already carries. Confirmed bookings only. Times are real UTC instants.',
    }),
    ApiOkResponse({
      description: 'RFC 5545 VCALENDAR with a single VEVENT.',
      content: { 'text/calendar': { schema: { type: 'string' } } },
    }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description: 'Booking is not CONFIRMED, so it has no calendar entry',
    }),
    ApiUnprocessableEntityResponse({
      description:
        'Booking has no resolvable start instant (no timezone snapshot).',
    }),
  );

export const ApiGetBookingDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a booking by uuid (auth-scoped)' }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiListBookingsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'List bookings (admin: all · operator: their tours · user: their own)',
    }),
    ApiOkResponse({ type: ListBookingsResponseDto }),
  );

export const ApiListBookingEmailsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Send-log timeline for a booking's emails (auth-scoped)",
      description:
        'EmailSend rows (sent / failed / suppressed, incl. admin resends) for this booking, newest first. Scoped like GET /bookings/:id.',
    }),
    ApiOkResponse({ type: [EmailSendDto] }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );
