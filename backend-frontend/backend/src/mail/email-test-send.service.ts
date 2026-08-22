import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CancellationRefund,
  Currency,
  EmailStream,
  EmailTemplateKey,
  Locale,
  PaymentModel,
} from '@prisma/client';
import { emailIconBase } from '@/bookings/booking-email.context';
import { DEFAULT_WHATSAPP_URL } from '@/common/utils/whatsapp.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EmailLogService,
  TIMELINE_SELECT,
  KEY_STREAM,
} from './email-log.service';
import {
  buildCancellationEmailContext,
  buildCancellationEmailText,
} from './cancellation-email.context';
import { emailSafeLogoUrl } from './email-logo.util';
import { MailService } from './mail.service';
import type { EmailTemplateContext } from './templates/email-template.renderer';
import { copyFor, fillCopy } from './templates/email-copy.util';
import { CANCELLATION_EMAIL_COPY } from './templates/cancellation-email.copy';
import {
  OPERATOR_APPROVED_SUBJECT,
  operatorApprovedTemplate,
  OPERATOR_BUILD_WITH_YOU_SUBJECT,
  operatorBuildWithYouTemplate,
  OPERATOR_CHECK_IN_SUBJECT,
  operatorCheckInTemplate,
  OPERATOR_CONNECT_CALENDAR_SUBJECT,
  operatorConnectCalendarTemplate,
  OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
  operatorFirstTourHowtoTemplate,
  OPERATOR_PAGE_STRONGER_SUBJECT,
  operatorPageStrongerTemplate,
  operatorPendingReminderSubject,
  operatorPendingReminderTemplate,
  operatorSignupInternalSubject,
  operatorSignupInternalTemplate,
  operatorTourLiveSubject,
  operatorTourLiveTemplate,
  OPERATOR_VERIFY_EMAIL_SUBJECT,
  operatorVerifyEmailTemplate,
  OPERATOR_WELCOME_AGREEMENT_SUBJECT,
  operatorWelcomeAgreementTemplate,
  tourSubmittedSalesSubject,
  tourSubmittedSalesTemplate,
} from './templates';

/**
 * The scopeId prefix for one admin's test rows. Documented in emails.prisma:
 * `test:` can never equal a booking/operator UUID, so the sweep anti-joins
 * (which compare scopeId to `o."id"` / `b."id"` exactly) can never treat a
 * test row as a real decision — asserted in the spec.
 */
export function testScopePrefix(userId: string): string {
  return `test:${userId}#`;
}

// ── Fixed sample data (H-07) ─────────────────────────────────────────────────
// The render-spec sample shapes (booking-confirmation / pre-tour-reminder /
// next-adventure specs) with a stable fictional booking, so a test-send
// exercises every optional block of the locked templates. All URLs point at
// the production site or example hosts — nothing here derives from user
// input except the recipient address.

const SAMPLE = {
  tourName: 'Klein Curacao Day Trip',
  operatorName: 'Miss Ann Boat Trips',
  bookingRef: 'IT-2026-04821',
  firstName: 'Denley',
  dateLong: 'Friday, 22 May 2026',
  dateShort: '22 May 2026',
  startTime: '08:00',
  heroImage: 'https://res.cloudinary.com/demo/image/upload/w_1200/sample.jpg',
};

function confirmationSample(iconBase: string, logo: string | null) {
  const ctx: EmailTemplateContext = {
    emailIconBase: iconBase,
    siteLogoUrl: logo ?? '',
    firstName: SAMPLE.firstName,
    bookingRef: SAMPLE.bookingRef,
    tourName: SAMPLE.tourName,
    operatorName: SAMPLE.operatorName,
    featuredImageUrl: SAMPLE.heroImage,
    dateLong: SAMPLE.dateLong,
    startTime: SAMPLE.startTime,
    hasPickup: true,
    pickupLocation: 'Hotel Brion',
    pickupTime: '07:15',
    meetingPoint: 'Sint Annabaai Pier',
    mapUrl: 'https://maps.example.com/x',
    arrivalBufferMin: 5,
    endPoint: 'Jan Thiel Beach',
    partyBreakdown: '2 adults, 1 child',
    duration: '9 hours',
    tourLanguage: 'English',
    specialRequests: 'Vegetarian lunch for one',
    operatorNote: 'Bring a towel.',
    paymentModel: 'operator_link',
    onArrivalPayment: '',
    depositPct: 30,
    depositAmount: '$60.00',
    balanceAmount: '$160.00',
    totalAmount: '$220.00',
    paidAmount: '$220.00',
    whatsappUrl: DEFAULT_WHATSAPP_URL,
    tourUrl: 'https://example.com/en/curacao/klein-curacao-day-trip',
    calendarUrl: 'https://example.com/ics/test',
    cancelUrl: 'https://example.com/cancel/test',
    whatToBring: ['Sunscreen', 'Towel'],
    knowBeforeYouGo: ['Bring ID'],
    freeCancellationDeadline: 'Wednesday 20 May, 08:00',
    paymentMethodLine: 'Visa ending 4242',
    bookingsUrl: 'https://example.com/bookings',
    browseUrl: 'https://example.com/curacao/tours',
    locale: 'en',
    dateShort: SAMPLE.dateShort,
    cancelDeadlineDateTime: 'Wednesday 20 May 2026, 08:00',
    operatorPhone: '+5999 123 4567',
    operatorEmail: 'hello@example.com',
    accountUrl: 'https://example.com/bookings',
    accountUrlLabel: 'island.tours/bookings',
    islandName: 'Curacao',
    relatedTourOneImageUrl: SAMPLE.heroImage,
    relatedTourOneName: 'Blue Room Snorkel',
    relatedTourOneRating: '4.8',
    relatedTourOnePrice: 'from $45',
    relatedTourTwoImageUrl: SAMPLE.heroImage,
    relatedTourTwoName: 'Christoffel Sunrise Hike',
    relatedTourTwoRating: '4.7',
    relatedTourTwoPrice: 'from $35',
    allToursUrl: 'https://example.com/curacao/tours',
    recommendationOneName: '',
    recommendationOneImageUrl: '',
    recommendationOneMeta: '',
    recommendationOneCtaLabel: '',
    recommendationOneUrl: '',
    recommendationTwoName: '',
    recommendationTwoImageUrl: '',
    recommendationTwoMeta: '',
    recommendationTwoCtaLabel: '',
    recommendationTwoUrl: '',
    recommendationThreeName: '',
    recommendationThreeImageUrl: '',
    recommendationThreeMeta: '',
    recommendationThreeCtaLabel: '',
    recommendationThreeUrl: '',
  };
  return ctx;
}

function reminderSample(iconBase: string, logo: string | null) {
  const ctx: EmailTemplateContext = {
    locale: 'en',
    subjectLine: `Tomorrow: ${SAMPLE.tourName} · ${SAMPLE.startTime}`,
    previewText:
      'Pickup at 07:15 from Hotel Brion. Your reference, what to bring, and who to call.',
    emailIconBase: iconBase,
    siteLogoUrl: logo ?? '',
    headline: `You're set for tomorrow, ${SAMPLE.firstName}.`,
    subLinePrefix: `${SAMPLE.tourName} · tomorrow at`,
    startTime: SAMPLE.startTime,
    localTimeSuffix: '(local time)',
    refLabel: 'Booking reference:',
    bookingRef: SAMPLE.bookingRef,
    tourName: SAMPLE.tourName,
    operatorName: SAMPLE.operatorName,
    featuredImageUrl: SAMPLE.heroImage,
    dateLong: SAMPLE.dateLong,
    hasPickup: true,
    pickupLabel: 'Pickup:',
    pickupLocation: 'Hotel Brion',
    beReadyAt: 'be ready at',
    pickupTime: '07:15',
    meetingPointLabel: 'Meeting point:',
    meetingPoint: 'Sint Annabaai Pier',
    arriveEarlyLine: 'Please arrive 15 minutes early.',
    mapUrl: 'https://maps.example.com/x',
    openInMaps: 'Open in Maps',
    partyBreakdown: '2 adults, 1 child',
    durationLine: 'Duration: 9 hours, back around 17:00',
    whatToBringTitle: 'What to bring',
    whatToBring: [
      'Towel and swimwear',
      'Reef-safe sunscreen (protects the coral and your skin)',
      'A light jacket for the crossing',
    ],
    balanceTitle: 'Remaining balance',
    // Split around the amount so the template can bold it: `{token}` values are
    // HTML-escaped by the renderer, so markup inside a copy string never
    // survives. The old single `balanceNote` key is gone from the template.
    balanceNotePrefix: 'Your remaining balance of',
    balanceAmount: '$160.00',
    balanceNoteSuffix: `runs through ${SAMPLE.operatorName}'s payment link. Already paid? You're all set.`,
    weatherDependent: true,
    weatherNote:
      `${SAMPLE.operatorName} watches the weather and contacts you directly if conditions ` +
      'force a change. If the operator cancels: a full refund or a free reschedule, always.',
    questionsTitle: 'Questions about tomorrow?',
    talkToLocals: 'Talk to the locals running it:',
    operatorPhone: '+599 9 123 4567',
    operatorEmail: 'hello@example.com',
    platformIssue: 'Booking or platform issue?',
    whatsappUrl: DEFAULT_WHATSAPP_URL,
    whatsappUs: 'WhatsApp us',
    supportHours: ', daily 08:00 to 20:00.',

    // The "Islanders also love..." rail. The preview shows it populated: an
    // admin checking the template needs to SEE the block that only ships to
    // travellers who have not opted out of marketing.
    railTitle: 'Islanders also love...',
    railSubhead: 'Picked to pair with your booking',
    railOpenThisWeek: 'Open departures this week',
    railCta: "Browse the Islanders' top picks",
    railCtaUrl: 'https://example.com/en/curacao/tours/',
    crossSellOneName: 'Christoffel Sunrise Hike',
    crossSellOneImageUrl: SAMPLE.heroImage,
    crossSellOneMetaPrefix: '★ 4.8 (212) · from ',
    crossSellOnePrice: '$89',
    crossSellTwoName: 'Spanish Water Kayak Tour',
    crossSellTwoImageUrl: SAMPLE.heroImage,
    crossSellTwoMetaPrefix: '★ 4.9 (167) · from ',
    crossSellTwoPrice: '$65',
    // The rail is soft-opt-in marketing inside a transactional send, so the
    // footer promises a way out. The preview uses a dead link: minting a real
    // token for a test render would let a click unsubscribe the admin.
    picksNotePrefix: 'You get these picks as an Island Tours guest.',
    picksNoteSuffix: '(your booking emails always arrive).',
    unsubscribeLabel: 'Unsubscribe from offers',
    unsubscribeUrl: 'https://example.com/unsubscribe/test-token',
  };
  return ctx;
}

function nextAdventureCard(prefix: string, name: string) {
  return {
    [`${prefix}Url`]: 'https://example.com/en/curacao/sample-tour/',
    [`${prefix}ImageUrl`]: SAMPLE.heroImage,
    [`${prefix}Name`]: name,
    [`${prefix}MetaPrefix`]: '★ 4.8 (212) · 4 hrs · from ',
    [`${prefix}Price`]: '$89',
    [`${prefix}OpenDays`]: 'Open: Thu, Fri, Sat',
    [`${prefix}Line`]:
      'You have been on the water. This is the land version of it.',
  };
}

function nextAdventureSample(iconBase: string, logo: string | null) {
  const ctx: EmailTemplateContext = {
    locale: 'en',
    subjectLine: `Where our guides send people after ${SAMPLE.tourName}`,
    previewText:
      'Three with spots open this week. Already home? Save them for next time.',
    emailIconBase: iconBase,
    siteLogoUrl: logo ?? '',
    headline: 'Still have days left on the island?',
    introBeforeTourName:
      'These three have open departures this week, and they are the ones we would send our own friends to after ',
    bookedTourName: SAMPLE.tourName,
    introAfterTourName: '.',
    alreadyHome: 'Already home? Save them for the next trip.',
    ...nextAdventureCard('cardOne', 'Blue Room Snorkel'),
    ...nextAdventureCard('cardTwo', 'Christoffel Sunrise Hike'),
    ...nextAdventureCard('cardThree', 'Westpunt Beach Hop'),
    seeTimes: 'See times',
    fillNote: 'Most boats leave before 8am and fill up a day or two ahead.',
    allToursUrl: 'https://example.com/en/curacao/tours/',
    seeAllLabel: 'See all 25 tours on Curacao',
    rescheduleBold: 'Free reschedule up to 24 hours before departure.',
    rescheduleRest: 'Plans on a holiday change. That is fine.',
    footerBeforeTourName: 'You are getting this because you booked ',
    footerAfterTourName:
      ' with Island Tours. Your booking emails always arrive.',
    unsubscribeUrl: 'https://example.com/unsubscribe/test-token',
    unsubscribeLabel: 'Unsubscribe',
    fewerEmailsLabel: 'Get fewer emails',
  };
  return ctx;
}

/**
 * WP-H (H-07): `POST /email/test-send { templateKey }` — renders the chosen
 * template with the FIXED sample data above and sends it to the CALLING
 * admin's own address. Booking templates are included on purpose: a
 * test-send is a rendering check, not a switch.
 *
 * Every test-send is logged under `scopeId = test:<userId>#<n>` (n =
 * count-based, like the resend rows) so it appears in the activity list as
 * itself and can never occupy a real booking/operator's send-once slot.
 */
@Injectable()
export class EmailTestSendService {
  private readonly logger = new Logger(EmailTestSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailLog: EmailLogService,
  ) {}

  async testSend(
    actor: { id: string; email: string },
    templateKeyParam: string,
  ) {
    const key = (Object.values(EmailTemplateKey) as string[]).includes(
      templateKeyParam,
    )
      ? (templateKeyParam as EmailTemplateKey)
      : null;
    if (!key) {
      throw new BadRequestException(
        `Unknown template key '${templateKeyParam}'`,
      );
    }
    const to = actor.email;

    let scopeId = await this.nextTestScopeId(key, actor.id);
    let result = await this.emailLog.claimAndSend({
      templateKey: key,
      scopeId,
      toEmail: to,
      stream: KEY_STREAM[key],
      locale: Locale.en,
      send: () => this.renderAndSend(key, to),
    });
    if (result.outcome === 'skipped') {
      // A concurrent test-send won our n — same retry-once rule as the
      // admin resend path (the count moved on, so recomputing yields n+1).
      scopeId = await this.nextTestScopeId(key, actor.id);
      result = await this.emailLog.claimAndSend({
        templateKey: key,
        scopeId,
        toEmail: to,
        stream: KEY_STREAM[key],
        locale: Locale.en,
        send: () => this.renderAndSend(key, to),
      });
    }

    this.logger.log(
      `Test-send ${key} by user ${actor.id}: ${result.outcome} (${scopeId})`,
    );
    return this.prisma.emailSend.findUnique({
      where: { templateKey_scopeId: { templateKey: key, scopeId } },
      select: TIMELINE_SELECT,
    });
  }

  /** `test:<userId>#<n>` — n = count of this user's rows for the key, +1. */
  private async nextTestScopeId(
    key: EmailTemplateKey,
    userId: string,
  ): Promise<string> {
    const prefix = testScopePrefix(userId);
    const n = await this.prisma.emailSend.count({
      where: {
        templateKey: key,
        // Explicit btree range instead of startsWith — the EmailLogService
        // resendRange rationale (collation-proof index use).
        scopeId: { gte: prefix, lt: `${prefix}\uffff` },
      },
    });
    return `${prefix}${n + 1}`;
  }

  /** Render the key's template with the fixed sample and send to `to`. */
  private async renderAndSend(
    key: EmailTemplateKey,
    to: string,
  ): Promise<{ providerMessageId: string | null }> {
    const iconBase = emailIconBase();
    const logo = await this.siteLogo();
    const acceptedAt = new Date();
    // Sample operator/internal props — the wireframe's fictional operator.
    const operatorProps = {
      operatorName: 'Irie Tours B.V.',
      signatoryName: 'Mayra Martina',
      email: 'mayra@example.com',
      phone: '+599 9 561 22 43',
      acceptedAt,
      reviewUrl: 'https://example.com/tour-operators/sample/edit',
    };
    const optOutUrl = 'https://example.com/unsubscribe/test-token';

    switch (key) {
      case EmailTemplateKey.BK1_CONFIRMATION:
        return this.mail.sendBookingConfirmationEmail(
          to,
          `You're booked: ${SAMPLE.tourName} on ${SAMPLE.dateShort}`,
          confirmationSample(iconBase, logo),
          `You're booked: ${SAMPLE.tourName} on ${SAMPLE.dateShort} (test render)`,
        );
      case EmailTemplateKey.BK2_PRE_TOUR_REMINDER:
        return this.mail.sendPreTourReminderEmail(
          to,
          `Tomorrow: ${SAMPLE.tourName} · ${SAMPLE.startTime}`,
          reminderSample(iconBase, logo),
          `Tomorrow: ${SAMPLE.tourName} at ${SAMPLE.startTime} (test render)`,
        );
      case EmailTemplateKey.BK3_REVIEW_REQUEST:
      case EmailTemplateKey.BK3R_REVIEW_REMINDER:
        return this.mail.sendReviewRequestEmail(to, {
          firstName: SAMPLE.firstName,
          tourName: SAMPLE.tourName,
          bookingRef: SAMPLE.bookingRef,
          // The sample date behind SAMPLE.dateLong ("Friday, 22 May 2026"),
          // raw: BK-3 formats it itself so no surface can hand-roll it.
          tourDate: new Date('2026-05-22T00:00:00.000Z'),
          tourImageUrl: SAMPLE.heroImage,
          partyLines: ['2 adults', '1 child'],
          reviewUrl: 'https://example.com/review/test-token',
          siteLogoUrl: logo,
          isReminder: key === EmailTemplateKey.BK3R_REVIEW_REMINDER,
          locale: Locale.en,
          operatorName: SAMPLE.operatorName,
          whatsappOptIn: key === EmailTemplateKey.BK3R_REVIEW_REMINDER,
        });
      case EmailTemplateKey.MK1_NEXT_ADVENTURE: {
        const ctx = nextAdventureSample(iconBase, logo);
        return this.mail.sendNextAdventureEmail(
          to,
          String(ctx.subjectLine),
          ctx,
          `${SAMPLE.tourName}: three tours with spots open this week (test render)`,
          {},
        );
      }
      case EmailTemplateKey.CX1_CANCELLATION: {
        // Through CX-1's OWN template and context builder — the same route
        // sendCancellationConfirmedNotices takes. It used to render the shared
        // notice shell, so the preview showed a green success chip and an
        // orange CTA that the real email no longer has.
        //
        // operator_link + FULL is the richest branch: the deposit-split copy,
        // which names both what we return and what the operator owes.
        const ctx = buildCancellationEmailContext({
          booking: {
            displayRef: SAMPLE.bookingRef,
            customerLocale: Locale.en,
            currency: Currency.USD,
            paymentModel: PaymentModel.OPERATOR_LINK,
            cancellationRefund: CancellationRefund.FULL,
            depositAmount: '44.00',
            totalAmount: '220.00',
            tourStartDateTime: null,
            localDate: new Date('2026-05-22T00:00:00.000Z'),
          },
          tourName: SAMPLE.tourName,
          operatorName: SAMPLE.operatorName,
          site: { logoUrl: logo },
          config: { emailIconBase: iconBase },
        });
        return this.mail.sendCancellationEmail(
          to,
          String(ctx.subjectLine),
          ctx,
          buildCancellationEmailText(ctx),
        );
      }
      // OB-1 previews the OPERATOR variant, which is what this key logs in
      // production. The traveller/account verification is a different design
      // family and is not part of the operator email centre.
      case EmailTemplateKey.OB1_VERIFY_EMAIL:
        return this.send(to, OPERATOR_VERIFY_EMAIL_SUBJECT, () =>
          operatorVerifyEmailTemplate({
            verifyUrl: 'https://example.com/verify/test-token',
          }),
        );
      case EmailTemplateKey.OB2_WELCOME_AGREEMENT:
        return this.send(to, OPERATOR_WELCOME_AGREEMENT_SUBJECT, () =>
          operatorWelcomeAgreementTemplate({
            firstName: 'Mayra',
            acceptedAt,
            agreementVersion: null,
            agreementUrl: null,
            supportEmail: 'hello@example.com',
            whatsappUrl: DEFAULT_WHATSAPP_URL,
          }),
        );
      case EmailTemplateKey.OB2A_APPROVED:
        return this.send(to, OPERATOR_APPROVED_SUBJECT, () =>
          operatorApprovedTemplate({
            firstName: 'Mayra',
            companyName: operatorProps.operatorName,
            addTourUrl: 'https://example.com/trips/new',
            dashboardUrl: 'https://example.com',
          }),
        );
      case EmailTemplateKey.OB3_FIRST_TOUR_HOWTO:
        return this.send(to, OPERATOR_FIRST_TOUR_HOWTO_SUBJECT, () =>
          operatorFirstTourHowtoTemplate({
            addTourUrl: 'https://example.com/trips/new',
            guideUrl: 'https://example.com/trips/new',
            walkthroughVideoUrl: null,
            walkthroughDuration: null,
            optOutUrl,
          }),
        );
      case EmailTemplateKey.OB4_BUILD_IT_WITH_YOU:
        return this.send(to, OPERATOR_BUILD_WITH_YOU_SUBJECT, () =>
          operatorBuildWithYouTemplate({
            whatsappUrl: DEFAULT_WHATSAPP_URL,
            salesEmail: 'sales@example.com',
            addTourUrl: 'https://example.com/trips/new',
            optOutUrl,
          }),
        );
      case EmailTemplateKey.OB5_TOUR_LIVE:
        return this.send(to, operatorTourLiveSubject(SAMPLE.tourName), () =>
          operatorTourLiveTemplate({
            tourName: SAMPLE.tourName,
            tourUrl: 'https://example.com/en/curacao/klein-curacao-day-trip',
            availabilityUrl: 'https://example.com/availability',
          }),
        );
      case EmailTemplateKey.OB6_CHECK_IN:
        return this.send(to, OPERATOR_CHECK_IN_SUBJECT, () =>
          operatorCheckInTemplate({ firstName: 'Mayra', optOutUrl }),
        );
      case EmailTemplateKey.OB7_CONNECT_CALENDAR:
        return this.send(to, OPERATOR_CONNECT_CALENDAR_SUBJECT, () =>
          operatorConnectCalendarTemplate({
            connectUrl: 'https://example.com/calendar',
            optOutUrl,
          }),
        );
      case EmailTemplateKey.OB8_PAGE_STRONGER:
        return this.send(to, OPERATOR_PAGE_STRONGER_SUBJECT, () =>
          operatorPageStrongerTemplate({
            includePartnerOffer: true,
            photoShootContactUrl: DEFAULT_WHATSAPP_URL,
            toursUrl: 'https://example.com/trips',
            optOutUrl,
          }),
        );
      case EmailTemplateKey.INT1_NEW_OPERATOR:
        return this.send(
          to,
          operatorSignupInternalSubject(operatorProps.operatorName),
          () => operatorSignupInternalTemplate(operatorProps),
        );
      case EmailTemplateKey.INT1R_PENDING_REMINDER:
        return this.send(
          to,
          operatorPendingReminderSubject(operatorProps.operatorName),
          () => operatorPendingReminderTemplate(operatorProps),
        );
      case EmailTemplateKey.INT2_NEW_TOUR:
        return this.send(to, tourSubmittedSalesSubject(SAMPLE.tourName), () =>
          tourSubmittedSalesTemplate({
            tourName: SAMPLE.tourName,
            operatorName: operatorProps.operatorName,
            submittedAt: acceptedAt,
            reviewUrl: operatorProps.reviewUrl,
          }),
        );
      default: {
        // Exhaustive: a new enum key fails compilation above before it can
        // reach here at runtime.
        const exhaustive: never = key;
        throw new BadRequestException(
          `No renderer for template ${String(exhaustive)}`,
        );
      }
    }
  }

  private send(
    to: string,
    subject: string,
    render: () => { html: string; text: string },
  ): Promise<{ providerMessageId: string | null }> {
    const { html, text } = render();
    return this.mail.sendMail({ to, subject, html, text });
  }

  /** Real dashboard logo when one exists — a test render should look real. */
  private async siteLogo(): Promise<string | null> {
    try {
      const info = await this.prisma.siteInfo.findFirst({
        select: { logo: true },
      });
      return emailSafeLogoUrl(info?.logo);
    } catch {
      return null;
    }
  }
}
