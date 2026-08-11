// DEMO SEED — email send-log rows (WP-A). A handful of `EmailSend` rows in all
// three states (SENT / FAILED / SUPPRESSED, plus one #resend row) so the
// dashboard's email-timeline components (WP-E) have something to render
// against demo operators and bookings.

import {
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
  Prisma,
} from '@prisma/client';
import { DEMO_EMAIL_DOMAIN, demoId, log, prisma, section } from './_shared';

export async function seedEmailSends(): Promise<void> {
  section('Email send log');

  const operators = await prisma.operator.findMany({
    where: { user: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, user: { select: { email: true } } },
  });
  const bookings = await prisma.booking.findMany({
    where: { contactEmail: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, contactEmail: true },
  });
  if (operators.length === 0 || bookings.length === 0) {
    log('skipped (no demo operators/bookings found)');
    return;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

  type Row = {
    key: string;
    data: Omit<Prisma.EmailSendUncheckedCreateInput, 'id'>;
  };
  const [opA, opB = operators[0]] = operators;
  const [bkA, bkB = bookings[0]] = bookings;
  const rows: Row[] = [
    // Operator onboarding trail: welcome sent, nudge failed, resend recovered,
    // and a suppressed OB-7 (feature flag off) - one of each timeline badge.
    {
      key: `ob2:${opA.id}`,
      data: {
        templateKey: EmailTemplateKey.OB2_WELCOME_AGREEMENT,
        scopeId: opA.id,
        toEmail: opA.user.email,
        stream: EmailStream.TRANSACTIONAL,
        status: EmailSendStatus.SENT,
        createdAt: daysAgo(9),
      },
    },
    {
      key: `ob3:${opA.id}`,
      data: {
        templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
        scopeId: opA.id,
        toEmail: opA.user.email,
        stream: EmailStream.LIFECYCLE,
        status: EmailSendStatus.FAILED,
        error: 'Email send failed: application_error',
        createdAt: daysAgo(7),
      },
    },
    {
      key: `ob3-resend:${opA.id}`,
      data: {
        templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
        scopeId: `${opA.id}#resend-1`,
        toEmail: opA.user.email,
        stream: EmailStream.LIFECYCLE,
        status: EmailSendStatus.SENT,
        createdAt: daysAgo(6),
      },
    },
    {
      key: `ob7:${opB.id}`,
      data: {
        templateKey: EmailTemplateKey.OB7_CONNECT_CALENDAR,
        scopeId: opB.id,
        toEmail: opB.user.email,
        stream: EmailStream.LIFECYCLE,
        status: EmailSendStatus.SUPPRESSED,
        suppressedReason: 'calendar-sync-unavailable',
        createdAt: daysAgo(3),
      },
    },
    // Booking trail: confirmation sent, review request suppressed (opt-out).
    {
      key: `bk1:${bkA.id}`,
      data: {
        templateKey: EmailTemplateKey.BK1_CONFIRMATION,
        scopeId: bkA.id,
        toEmail: bkA.contactEmail ?? `traveler@${DEMO_EMAIL_DOMAIN}`,
        stream: EmailStream.TRANSACTIONAL,
        status: EmailSendStatus.SENT,
        locale: 'en',
        createdAt: daysAgo(5),
      },
    },
    {
      key: `bk3:${bkB.id}`,
      data: {
        templateKey: EmailTemplateKey.BK3_REVIEW_REQUEST,
        scopeId: bkB.id,
        toEmail: bkB.contactEmail ?? `traveler@${DEMO_EMAIL_DOMAIN}`,
        stream: EmailStream.TRANSACTIONAL,
        status: EmailSendStatus.SUPPRESSED,
        suppressedReason: 'cancelled-before-tour',
        locale: 'en',
        createdAt: daysAgo(1),
      },
    },
  ];

  for (const row of rows) {
    await prisma.emailSend.upsert({
      where: { id: demoId('email-send', row.key) },
      update: {},
      create: { id: demoId('email-send', row.key), ...row.data },
    });
  }
  log(`${rows.length} email send-log rows`);
}

/** Removes every demo send-log row (they all target demo-domain inboxes). */
export async function cleanEmailSends(): Promise<void> {
  await prisma.emailSend.deleteMany({
    where: { toEmail: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });
}
