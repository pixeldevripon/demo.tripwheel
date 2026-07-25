import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';
import type { GoogleUserData } from '@/tracking/pii-hash.util';
import {
  AddOnUnit,
  BookingStatus,
  CancelledBy,
  CancellationRefund,
  Currency,
  PaymentModel,
  SettlementStatus,
} from '@prisma/client';
import { SettlementMethod } from '@/settlements/dto/settlement.dto';

// ════════════════════════════════════════════════════════════════════════════
// Derived display status
// ════════════════════════════════════════════════════════════════════════════
// `status` is the persisted BookingStatus enum and drives all server logic. But
// a booking whose traveller has ASKED to cancel is still CONFIRMED until an
// admin acts on it - showing "Confirmed" then reads as if nothing happened. The
// display status layers one derived value on top for EVERY status surface
// (dashboard tables, TYP, customer /bookings): CONFIRMED + a pending request
// (requested, not yet cancelled) -> CANCELLATION_REQUESTED. It is computed on
// the server so no client re-derives it (and gets it wrong); the raw `status`
// still rides alongside for anything that needs the true enum.
export const BOOKING_DISPLAY_STATUSES = [
  ...Object.values(BookingStatus),
  'CANCELLATION_REQUESTED',
  'NON_PAYMENT_REPORTED',
  'FORFEITED',
] as const;

export type BookingDisplayStatus =
  | BookingStatus
  | 'CANCELLATION_REQUESTED'
  | 'NON_PAYMENT_REPORTED'
  | 'FORFEITED';

export function deriveBookingDisplayStatus(booking: {
  status: BookingStatus;
  utcCancellationRequestedAt: Date | null;
  utcCancelledAt: Date | null;
  utcNonPaymentReportedAt?: Date | null;
  utcForfeitedAt?: Date | null;
}): BookingDisplayStatus {
  // Forfeited (guide s15): terminated by an admin-confirmed non-payment report -
  // the deposit was kept, which "Cancelled" alone would misrepresent.
  if (
    booking.status === BookingStatus.CANCELLED &&
    (booking.utcForfeitedAt ?? null) !== null
  ) {
    return 'FORFEITED';
  }
  if (
    booking.status === BookingStatus.CONFIRMED &&
    booking.utcCancellationRequestedAt !== null &&
    booking.utcCancelledAt === null
  ) {
    return 'CANCELLATION_REQUESTED';
  }
  // Operator reported the balance unpaid; awaiting the admin verdict.
  if (
    booking.status === BookingStatus.CONFIRMED &&
    (booking.utcNonPaymentReportedAt ?? null) !== null &&
    (booking.utcForfeitedAt ?? null) === null
  ) {
    return 'NON_PAYMENT_REPORTED';
  }
  return booking.status;
}

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class BookingUnitItemResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Null for UNIT-priced tours (no age bands).',
  })
  ageBandId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: '79.99' }) priceRetail!: string;
}

/** Conversion payload for the browser Pixel (master booking_complete contract). */
export class BookingConversionDto {
  @ApiProperty({ example: 'Purchase' }) event!: string;
  @ApiProperty({
    example: 'b1a2…',
    description: 'Dedupe id shared with the server CAPI event.',
  })
  eventId!: string;
  @ApiProperty({
    example: 'EUR',
    description: 'Conversion value is always EUR (rule #22).',
  })
  currency!: string;
  @ApiProperty({
    example: '57.74',
    description: 'Conversion value = commission_amount in EUR.',
  })
  value!: string;
  @ApiProperty() contentId!: string;
  @ApiPropertyOptional({ nullable: true }) contentName!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'SHA-256 hashed PII for Google Enhanced Conversions (master 8.3 user_data), ' +
      'hashed server-side so raw PII never reaches the browser. Null when there is ' +
      'no email to hash. Same hash pass the server CAPI uses.',
  })
  userData!: GoogleUserData | null;
}

/** Operator contact shown on the TYP (named deliberately post-booking - guide §13). */
export class ThankYouOperatorDto {
  @ApiPropertyOptional({ nullable: true, example: 'Miss Ann Boat Trips' })
  name!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'reservation@missannboattrips.com',
  })
  email!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '+599 9 123 4567' })
  phone!: string | null;
}

/** One grouped party line ("2 x Adult"); `ageBandId` is null for UNIT-priced tours. */
export class ThankYouPartyLineDto {
  @ApiPropertyOptional({ nullable: true }) ageBandId!: string | null;
  @ApiProperty({ example: 'Adult' }) label!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
}

/** One purchased extra (immutable BookingAddOn snapshot), booking currency. */
export class ThankYouAddOnDto {
  @ApiProperty({ example: 'Open bar upgrade' }) name!: string;
  @ApiProperty({ enum: AddOnUnit }) unit!: AddOnUnit;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '25.00' }) unitPrice!: string;
  @ApiProperty({ example: '100.00' }) totalPrice!: string;
}

/**
 * Result of the TYP "Resend email" action.
 *
 * Deliberately carries no recipient: the TYP already shows the address, and
 * echoing it back would turn a @Public endpoint into an address oracle for
 * anyone holding a publicRef.
 */
export class ResendConfirmationResponseDto {
  @ApiProperty({ example: true }) sent!: boolean;
}

/**
 * Body of the tokenized cancellation-request form (master 6.4/C1). The form
 * never cancels anything - it emails the admin, so the only input is the
 * traveller's optional note.
 */
export class RequestCancellationDto {
  @ApiPropertyOptional({
    example: 'Our cruise itinerary changed.',
    description: "Optional 'Anything you'd like us to know?' note",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequestCancellationResponseDto {
  @ApiProperty({ example: true }) requested!: boolean;
}

/** One currency bucket of a customer's net spend (payments minus refunds). */
export class CustomerSpendDto {
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({
    example: '248.00',
    description: 'Net amount as an exact decimal string',
  })
  amount!: string;
}

/**
 * Customer dashboard stat row (GET /bookings/me/summary): always scoped to
 * the authenticated user's own bookings; spend is computed live from the
 * payment ledger, per currency.
 */
export class CustomerBookingSummaryDto {
  @ApiProperty({ example: 4, description: 'CONFIRMED + REDEEMED bookings' })
  bookingsCount!: number;

  @ApiProperty({ example: 1, description: 'Confirmed trips still ahead' })
  upcomingCount!: number;

  @ApiProperty({ type: [CustomerSpendDto] })
  totalSpend!: CustomerSpendDto[];
}

/**
 * Traveller booking lookup (`/bookings` login surface, spec 2): the email the
 * booking was made with + the human display reference from the confirmation
 * email. No passwords, no sign-up.
 */
export class LookupBookingDto {
  @ApiProperty({ example: 'traveller@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'IT-2026-0A1B2C',
    description: 'Human booking reference from the confirmation email',
  })
  @IsString()
  @MaxLength(40)
  reference!: string;
}

/** "Lost your reference?" recovery: the email the traveller booked with. */
export class RecoverReferenceDto {
  @ApiProperty({ example: 'traveller@example.com' })
  @IsEmail()
  email!: string;
}

/**
 * Always `{ sent: true }` - whether or not the email has bookings - so the
 * endpoint can never be used to probe which addresses booked with us.
 */
export class RecoverReferenceResponseDto {
  @ApiProperty({ example: true }) sent!: boolean;
}

/**
 * Successful lookup: just enough to build the TYP url
 * (`/{destinationSlug}/thank-you/{publicRef}`). A failed pair returns a generic
 * 404 - the response never confirms whether the email alone exists.
 */
export class BookingLookupResponseDto {
  @ApiProperty() publicRef!: string;

  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;

  @ApiProperty({ example: 'curacao', nullable: true }) destinationSlug!:
    | string
    | null;

  @ApiProperty({
    description:
      '24h traveler session (HMAC, email-bound). The verified pair IS the ' +
      'login (master 6.4): store HttpOnly and replay via X-Traveler-Session ' +
      'to unlock the full TYP and the cancellation request.',
  })
  sessionToken!: string;
}

/** Thank-you-page payload (TYP route - noindex, no locale prefix). */
export class ThankYouReviewStateDto {
  @ApiProperty({ example: false, description: 'A review already exists.' })
  reviewed!: boolean;
  @ApiProperty({
    example: true,
    description:
      'Tour finished, booking completed, no review yet, and a usable ' +
      'invitation exists. Mirrors the create gate so the CTA cannot offer ' +
      'something the API then refuses.',
  })
  canReview!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Single-use invitation token for the review page. A WRITE credential - ' +
      'present only on a verified payload, never for a shared publicRef.',
  })
  reviewToken!: string | null;
}

export class ThankYouResponseDto {
  @ApiProperty({
    description:
      'True when a valid X-Traveler-Session for this booking was presented. ' +
      'False = unverified mode: only non-identifying tour facts are returned ' +
      '(date, duration, trip name, free-cancel, party count). Guest name, ' +
      'guest email/phone, the operator email/phone, pickup address, and card ' +
      'details are all null - the bare publicRef link is a viewing capability, ' +
      'not identity.',
  })
  verified!: boolean;
  @ApiPropertyOptional({
    type: ThankYouReviewStateDto,
    nullable: true,
    description: 'FE-12 review affordance. Null on an unverified payload.',
  })
  review!: ThankYouReviewStateDto | null;

  @ApiProperty() publicRef!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({
    enum: BOOKING_DISPLAY_STATUSES,
    description:
      'Derived status for display. CONFIRMED with a pending cancellation ' +
      'request reads CANCELLATION_REQUESTED; otherwise equals `status`.',
  })
  displayStatus!: BookingDisplayStatus;

  // ── Cancellation state ──────────────────────────────────────────────────
  // The server owns this verdict. `canRequestCancellation` is the SAME
  // predicate the submit endpoint enforces, so the page can never offer a
  // request the API would refuse (and a traveller cannot re-submit past a
  // hidden button).
  @ApiPropertyOptional({
    nullable: true,
    description:
      'When the traveller asked to cancel. Non-null with status still CONFIRMED = request pending an admin decision.',
    example: '2026-07-19T10:00:00.000Z',
  })
  cancellationRequestedAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the cancellation was actually processed.',
    example: null,
  })
  cancelledAt!: string | null;

  @ApiProperty({
    description:
      'Whether a cancellation request would be accepted right now. Gate the cancel affordance on this, never on status alone.',
  })
  canRequestCancellation!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['ALREADY_REQUESTED', 'NOT_CONFIRMED', 'DEPARTED'],
    description: 'Why not, when canRequestCancellation is false.',
  })
  cancellationBlockedReason!: string | null;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: 'Sunset Catamaran Cruise' }) tourName!: string;
  @ApiPropertyOptional({ nullable: true, example: 'curacao' }) island!:
    | string
    | null;
  // The tour experience time is destination-LOCAL wall-clock. Render it from
  // localDate + startTime/endTime against timeZone. startsAtUtc/endsAtUtc are the
  // only real UTC instants here - use them for ICS/reminders/integrations, never
  // for display. (The old fake-`Z` tourStartDateTime/tourEndDateTime are gone.)
  @ApiProperty({ example: '2026-07-01' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true, example: '09:00' }) startTime!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: '13:00' }) endTime!:
    | string
    | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'IANA zone localDate/startTime/endTime are expressed in. Render against this; do not parse the local fields as UTC.',
    example: 'America/Curacao',
  })
  timeZone!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local start (integrations/ICS only).',
    example: '2026-07-01T13:00:00.000Z',
  })
  startsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local end (integrations/ICS only).',
    example: '2026-07-01T17:00:00.000Z',
  })
  endsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Marriott Beach Resort — main lobby',
  })
  pickupAddress!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'True when the traveler asked for pickup at reserve.',
  })
  pickupRequested!: boolean;
  @ApiProperty({ example: 2 }) partySize!: number;
  @ApiProperty({
    type: [ThankYouPartyLineDto],
    description: 'Party grouped by age band (renders "2 adults, 1 child").',
  })
  party!: ThankYouPartyLineDto[];
  @ApiProperty({
    type: [ThankYouAddOnDto],
    description:
      'Purchased extras (BookingAddOn snapshots). Empty when none were bought.',
  })
  addOns!: ThankYouAddOnDto[];

  // ── Guest (contact snapshot taken at checkout) ──────────────────────────────
  @ApiPropertyOptional({ nullable: true, example: 'Denley' })
  guestFirstName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Smith' })
  guestLastName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Denley Smith' })
  guestFullName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'ada@x.io' }) contactEmail!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: '+5999123456' })
  contactPhone!: string | null;

  // ── Money (charged currency; never the shopper cookie - guide §20.10) ───────
  @ApiProperty({ example: 'EUR' }) currency!: string;
  @ApiProperty({ example: '209.97' }) totalRetail!: string;
  @ApiProperty({
    example: '41.99',
    description: 'Collected by Island Tours up front; "0.00" = nothing online.',
  })
  depositAmount!: string;
  @ApiProperty({
    example: '167.98',
    description: 'Operator-collected remainder; "0.00" = paid in full.',
  })
  balanceAmount!: string;
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
    description:
      'Snapshotted at reserve (rule #21); drives the TYP money copy.',
  })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true, example: 'mastercard' })
  paymentMethodBrand!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '4242' })
  paymentMethodLast4!: string | null;

  // ── Tour facts + cancellation window ───────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, example: 540 })
  durationMinutes!: number | null;
  @ApiProperty({
    example: 48,
    description: 'Free-cancellation window in hours (enum-bound; rule #20).',
  })
  cancellationHours!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-01T09:00:00',
    description:
      'Local wall-clock deadline = tour start - cancellationHours. Computed, never stored (guide §14). Render against timeZone.',
  })
  freeCancellationDeadlineLocal!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-01T13:00:00.000Z',
    description: 'Real UTC instant of the deadline (reminders/integrations).',
  })
  freeCancellationDeadlineUtc!: string | null;

  @ApiProperty({ type: ThankYouOperatorDto })
  operator!: ThankYouOperatorDto;
  // NOTE: the booking_complete `conversion` payload is intentionally NOT on this
  // GET. It is served ONCE, mark-first, by `POST typ/:publicRef/conversion`
  // (ConversionPushResponseDto) so the browser pixel cannot double-fire across
  // refreshes / the processing poller (master 8.1 item 5, 8.2).
}

/**
 * Response of `POST typ/:publicRef/conversion` (master 8.2). `conversion` is the
 * one-time `booking_complete` push payload for the mark-first WINNER; every later
 * caller (refresh, second tab, shared link, non-verified, not-yet-confirmed)
 * receives `null` and pushes nothing.
 */
export class ConversionPushResponseDto {
  @ApiPropertyOptional({
    type: BookingConversionDto,
    nullable: true,
    description:
      'The booking_complete push payload, returned to the mark-first winner ' +
      'exactly once per booking; null on every subsequent call, an unverified ' +
      'session, a non-confirmed booking, or a null-commission (corrupt) booking.',
  })
  conversion!: BookingConversionDto | null;
}

export class BookingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() publicRef!: string;
  @ApiProperty() tourId!: string;
  @ApiPropertyOptional({ nullable: true }) departureId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({
    enum: BOOKING_DISPLAY_STATUSES,
    description:
      'Derived status for display. Equals `status`, except a CONFIRMED booking ' +
      'with a pending cancellation request reads CANCELLATION_REQUESTED. Render ' +
      'this in status chips; use `status` for logic.',
  })
  displayStatus!: BookingDisplayStatus;
  @ApiProperty({ example: false }) freesale!: boolean;
  @ApiPropertyOptional({ nullable: true }) utcExpiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) utcConfirmedAt!: string | null;
  @ApiProperty({ example: '2026-07-04' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true }) startTime!: string | null;
  @ApiProperty({ enum: ['USD', 'EUR'] }) currency!: string;
  @ApiProperty({ example: '239.97' }) totalRetail!: string;
  @ApiProperty({ example: '47.99' }) depositAmount!: string;
  @ApiProperty({ example: '191.98' }) balanceAmount!: string;
  @ApiPropertyOptional({ example: '0.2000', nullable: true })
  commissionRate!: string | null;
  @ApiPropertyOptional({ example: '47.99', nullable: true })
  commissionAmount!: string | null;
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
  })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true })
  cancellationRefund!: CancellationRefund | null;
  @ApiProperty({ type: [BookingUnitItemResponseDto] })
  unitItems!: BookingUnitItemResponseDto[];
}

/**
 * PATCH /bookings/:id response. When the patch sets the contact email
 * (checkout's contact step), it also returns a traveler session token so the
 * fresh booker lands on the TYP verified - see traveler-session.util.ts.
 */
export class UpdateBookingResponseDto extends BookingResponseDto {
  @ApiPropertyOptional({
    description:
      '24h traveler session (HMAC), BOOKING-scoped: unlocks only this ' +
      'booking (the contact email is caller-supplied and unproven here, so ' +
      'no email-wide token is ever minted from this endpoint). Present only ' +
      'when the patch set contact.email. Store HttpOnly, replay via ' +
      'X-Traveler-Session.',
  })
  sessionToken?: string;
}

/**
 * One row of the dashboard bookings/cancellation-requests tables: the booking
 * plus the display context the list needs (tour name, guest contact, request
 * timestamps and the computed free-window judgement).
 */
export class BookingListItemDto extends BookingResponseDto {
  @ApiProperty({ example: 'Klein Curacao Day Trip' }) tourName!: string;
  @ApiPropertyOptional({ nullable: true, example: 'Jane Doe' })
  contactFullName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'jane@example.com' })
  contactEmail!: string | null;
  @ApiProperty({ example: 4 }) partySize!: number;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'When the traveller requested cancellation (master 6.4).',
  })
  utcCancellationRequestedAt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'When the operator reported the balance unpaid (guide s15); awaiting an admin verdict while set.',
  })
  utcNonPaymentReportedAt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'When an admin confirmed the forfeit - the deposit was kept and the spot released.',
  })
  utcForfeitedAt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Free-cancellation deadline (tour start - cancellationHours, wall clock).',
  })
  freeCancelDeadline!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Whether the cancellation request landed inside the free window ' +
      '(judged at the request instant - C23). Null when never requested.',
  })
  requestedInFreeWindow!: boolean | null;
  @ApiProperty({
    example: true,
    description:
      'Server verdict on whether a cancellation request may be submitted. ' +
      'Clients render off this instead of re-deriving it - the start time is ' +
      'a local wall clock and means nothing without the tour timezone.',
  })
  canRequestCancellation!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    enum: ['ALREADY_REQUESTED', 'NOT_CONFIRMED', 'DEPARTED'],
    description:
      'Why a request cannot be submitted; null when it can. DEPARTED means ' +
      'the trip has already started.',
  })
  cancellationBlockedReason!:
    | 'ALREADY_REQUESTED'
    | 'NOT_CONFIRMED'
    | 'DEPARTED'
    | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: SettlementStatus,
    description:
      'Settlement-ledger status for this booking (null until confirmed). See the ' +
      'Settlements page for the full ledger.',
  })
  settlementStatus!: SettlementStatus | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: SettlementMethod,
    description:
      'HOW this booking settles: SELF_SETTLING / OPERATOR_PAYOUT / COMMISSION_INVOICE.',
  })
  settlementMethod!: SettlementMethod | null;
  @ApiProperty({
    description:
      "True when this booking's paid_in_full payout is HELD by a pending " +
      'cancellation request (same predicate as the Settlements page). Render ' +
      '"On hold - cancellation requested" beside the settlement badge.',
  })
  settlementHeld!: boolean;
  @ApiProperty({
    enum: ['NONE', 'PENDING', 'PARTIAL', 'REFUNDED'],
    description:
      'TRUE refund state from the payment ledger. PENDING = a cancel owes a ' +
      'refund that has NOT executed yet (money still held); REFUNDED = the ' +
      'charge was actually returned. Never assume "refunded" from the cancel ' +
      'verdict - render this.',
  })
  refundStatus!: 'NONE' | 'PENDING' | 'PARTIAL' | 'REFUNDED';
}

export class ListBookingsResponseDto {
  @ApiProperty({ example: 128 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [BookingListItemDto] }) data!: BookingListItemDto[];
}

/** One priced row of a quote breakdown (participants, an add-on, or a priced pickup). */
export class QuoteLineDto {
  @ApiProperty({
    enum: ['participant', 'addon', 'pickup'],
    example: 'participant',
  })
  kind!: 'participant' | 'addon' | 'pickup';
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Age-band id for a per-person participant line; null otherwise.',
  })
  ageBandId!: string | null;
  @ApiProperty({ example: 'Adult (13+)' }) label!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '79.99' }) unitPrice!: string;
  @ApiProperty({ example: '159.98' }) lineTotal!: string;
}

/**
 * Server-authoritative price quote (master §5, guide §20.4). A read-only preview
 * with NO side effects (no seat claim, no persistence). The `reserve` endpoint is
 * the authoritative write and recomputes the same math, so a quote is never trusted
 * as the source of truth for a persisted booking.
 *
 * Multi-currency/FX (source vs booking currency conversion) is a later phase; today
 * everything is priced in the tour's default currency, so the `source*` fields equal
 * their booking-currency counterparts and `sourceFxRateToBooking` is always "1".
 */
export class BookingQuoteResponseDto {
  @ApiProperty({
    description:
      'Opaque quote id (informational; not yet persisted/revalidated).',
  })
  quoteId!: string;
  @ApiProperty({
    example: '2026-07-16T12:15:00.000Z',
    description:
      'UTC instant this quote should no longer be trusted for display.',
  })
  expiresAt!: string;
  @ApiProperty({ enum: Currency, description: "The tour's default currency." })
  tourCurrency!: Currency;
  @ApiProperty({
    enum: Currency,
    description:
      'Booking currency (== tourCurrency until FX conversion ships).',
  })
  currency!: Currency;
  @ApiProperty({
    example: '1',
    description: 'Source→booking FX rate (1 for now).',
  })
  sourceFxRateToBooking!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '1',
    description: 'Booking→EUR FX rate; null when unknown (non-EUR, pre-FX).',
  })
  fxRateToEur!: string | null;
  @ApiProperty({ example: '209.97' }) sourceTotalRetail!: string;
  @ApiProperty({ example: '209.97' }) totalRetail!: string;
  @ApiProperty({ example: '41.99' }) sourceDepositAmount!: string;
  @ApiProperty({ example: '41.99' }) depositAmount!: string;
  @ApiProperty({ example: '167.98' }) sourceBalanceAmount!: string;
  @ApiProperty({ example: '167.98' }) balanceAmount!: string;
  @ApiProperty({
    example: '0.2000',
    description: 'Commission fraction (effective tier + any active Spotlight).',
  })
  commissionRate!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '41.99',
    description:
      'EUR commission; null when it cannot be resolved (non-EUR, pre-FX).',
  })
  commissionAmount!: string | null;
  @ApiProperty({
    enum: PaymentModel,
    description:
      'Drives which amount is charged today (deposit vs full vs none).',
  })
  paymentModel!: PaymentModel;
  @ApiProperty({ example: 2, description: 'Guest headcount priced.' })
  pax!: number;
  @ApiProperty({ type: [QuoteLineDto] }) lines!: QuoteLineDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Shared sub-DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveItemDto {
  @ApiProperty({ example: 'age-band-uuid' })
  @IsString()
  ageBandId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Traveler age (master child ages); enforced against the tour minimum age.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  travelerAge?: number;
}

export class ReserveAddOnDto {
  @ApiProperty({ example: 'addon-uuid' })
  @IsString()
  addOnId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ContactDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Byron' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+12125550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1011' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'CW' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: ['en'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locales?: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ad click ids + UTM parameters, captured on the landing page and carried to
 * reserve (master 8.1 item 6 / E.8 / dev spec 14). Snapshotted onto the booking
 * at creation only - they feed the `booking_complete` push (8.3 `click_ids`) and,
 * later, offline-conversion + cancellation/refund adjustments to Google Ads/Meta.
 * All optional and untrusted display strings; length-capped, never interpreted.
 */
export class AttributionDto {
  @ApiPropertyOptional({ description: 'Google Ads click id', maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  gclid?: string;

  @ApiPropertyOptional({ description: 'Google iOS web-to-app', maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  gbraid?: string;

  @ApiPropertyOptional({ description: 'Google app-to-web', maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  wbraid?: string;

  @ApiPropertyOptional({ description: 'Meta click id', maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fbclid?: string;

  @ApiPropertyOptional({ example: 'google', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmSource?: string;

  @ApiPropertyOptional({ example: 'cpc', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmMedium?: string;

  @ApiPropertyOptional({ example: 'summer-2026', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmCampaign?: string;

  @ApiPropertyOptional({ example: 'snorkeling curacao', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmTerm?: string;

  @ApiPropertyOptional({ example: 'hero-cta', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmContent?: string;
}

export class ReserveBookingDto {
  @ApiPropertyOptional({
    example: 'f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454',
    description: 'Client-supplied id - idempotency key. Generated if omitted.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiPropertyOptional({
    type: [ReserveItemDto],
    description:
      'PER_PERSON tours: one line per age band (required). Omit for UNIT tours - send `guests` instead.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items?: ReserveItemDto[];

  @ApiPropertyOptional({
    example: 6,
    description:
      'UNIT (whole-unit / charter) tours: total guest headcount (required for UNIT, rejected for PER_PERSON). Drives the charter surcharge and capacity.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: [34, 30, 8],
    description:
      'UNIT tours: optional per-guest ages (enforced against the tour minimum age).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  travelerAges?: number[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({
    example: 30,
    description: 'Hold window (default 30, max 60).',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;

  @ApiPropertyOptional({ example: 'Honeymoon trip', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Figma checkout marketing opt-in ("Send me the good stuff...").',
  })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper (booking) currency. Defaults to the tour currency. The tour price is converted server-side and snapshotted; the traveler is charged in this currency.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    example: 'quote-uuid',
    description:
      'Server quote id (guide §20.3). Accepted for forward-compat; reserve currently recomputes the quote server-side and is authoritative (quotes are not yet persisted).',
  })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @ApiPropertyOptional({
    type: AttributionDto,
    description:
      'Ad click ids + UTM captured on the landing page (master 8.1.6). Written ' +
      'onto the booking at creation only (first reserve); ignored on an idempotent ' +
      're-reserve so the original attribution is never overwritten.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttributionDto)
  attribution?: AttributionDto;

  // NOTE: couponCode/discountAmount are intentionally NOT accepted (flaw #2). A
  // client-supplied discount is untrusted without a server-side coupon-validation
  // engine; re-add them (validated) when that engine ships.
}

export class QuoteBookingDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiPropertyOptional({
    type: [ReserveItemDto],
    description:
      'PER_PERSON tours: one line per age band (required). Omit for UNIT tours - send `guests` instead.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items?: ReserveItemDto[];

  @ApiPropertyOptional({
    example: 6,
    description:
      'UNIT (whole-unit / charter) tours: total guest headcount (required for UNIT, rejected for PER_PERSON).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: [34, 30, 8],
    description:
      'UNIT tours: optional per-guest ages (enforced against the tour minimum age).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  travelerAges?: number[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper currency (forward-compat). Multi-currency conversion is a later phase, so the quote is currently priced in the tour default currency regardless.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  // NOTE: couponCode intentionally omitted (flaw #2) - discount preview waits for a
  // server-side coupon-validation engine.
}

export class ConfirmBookingDto {
  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @ApiPropertyOptional({ example: 'IT-RES-0042' })
  @IsOptional()
  @IsString()
  resellerReference?: string;

  @ApiPropertyOptional({ example: 'Please seat us together', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Override the cancellation-window refund policy (admin/operator).',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    example: '2026-06-28T14:03:00.000Z',
    description:
      'UTC instant the traveler requested cancellation. Refund eligibility is judged at this instant, not the (possibly later) admin action time. Defaults to any prior request stamp, else now.',
  })
  @IsOptional()
  @IsDateString()
  requestedAt?: string;
}

export class ExtendBookingDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'New hold window (default 30, max 60).',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @ApiPropertyOptional({ example: 'Updated note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({
    example: 'pickup-uuid',
    nullable: true,
    description: 'New pickup point; explicit null clears the pickup.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  pickupLocationId?: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ example: 'tour-uuid' })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({
    enum: BOOKING_DISPLAY_STATUSES,
    description:
      'Raw statuses match the persisted enum as-is. The three DERIVED values ' +
      'refine them: CANCELLATION_REQUESTED (confirmed + pending request), ' +
      'NON_PAYMENT_REPORTED (confirmed + pending report), FORFEITED ' +
      '(cancelled via an admin-confirmed non-payment forfeit).',
  })
  @IsOptional()
  @IsIn(BOOKING_DISPLAY_STATUSES)
  status?: BookingDisplayStatus;

  @ApiPropertyOptional({ enum: PaymentModel })
  @IsOptional()
  @IsEnum(PaymentModel)
  paymentModel?: PaymentModel;

  @ApiPropertyOptional({
    example: 'IT-2026-0A1B2C',
    description: 'Matches booking refs, guest name/email, or tour name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Only bookings where the traveller requested cancellation (master 6.4).',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  cancellationRequested?: boolean;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Re-export for service typing convenience.
export type { CancelledBy };
