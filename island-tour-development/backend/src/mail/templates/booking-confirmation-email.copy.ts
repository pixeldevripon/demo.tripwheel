import { Locale } from '@prisma/client';

/**
 * BK-1 confirmation SUBJECT copy, 7 locales (checklist B-18/B-22).
 *
 * Scope is deliberately the subject line only - the strings WP-B changed. The
 * template body is the design-LOCKED `booking-confirmation-email.template.html`
 * whose English copy is pinned byte-for-byte against the wireframe by its
 * render spec; localising the body is a separate design-owned pass, not a
 * side effect of this package.
 *
 * The today/tomorrow variants are the wireframe rule for bookings created
 * inside 24h of start: BK-2 is skipped for those (`jobsFor` never enqueues
 * it), so BK-1's subject carries the nudge instead.
 */
export interface ConfirmationSubjectCopy {
  /** "You're booked: {tourName} on {dateShort}" */
  subject: string;
  /** "You're booked today: {tourName}" - same-day, <24h booking. */
  subjectToday: string;
  /** "You're booked for tomorrow: {tourName}" - next-day, <24h booking. */
  subjectTomorrow: string;
}

export const CONFIRMATION_SUBJECT_COPY: Record<
  Locale,
  ConfirmationSubjectCopy
> = {
  [Locale.en]: {
    subject: "You're booked: {tourName} on {dateShort}",
    subjectToday: "You're booked today: {tourName}",
    subjectTomorrow: "You're booked for tomorrow: {tourName}",
  },
  [Locale.nl]: {
    subject: 'Geboekt: {tourName} op {dateShort}',
    subjectToday: 'Geboekt voor vandaag: {tourName}',
    subjectTomorrow: 'Geboekt voor morgen: {tourName}',
  },
  [Locale.de]: {
    subject: 'Gebucht: {tourName} am {dateShort}',
    subjectToday: 'Für heute gebucht: {tourName}',
    subjectTomorrow: 'Für morgen gebucht: {tourName}',
  },
  [Locale.fr]: {
    subject: 'Réservé : {tourName} le {dateShort}',
    subjectToday: "Réservé pour aujourd'hui : {tourName}",
    subjectTomorrow: 'Réservé pour demain : {tourName}',
  },
  [Locale.es]: {
    subject: 'Reserva confirmada: {tourName} el {dateShort}',
    subjectToday: 'Reserva para hoy: {tourName}',
    subjectTomorrow: 'Reserva para mañana: {tourName}',
  },
  [Locale.pt]: {
    subject: 'Reserva confirmada: {tourName} a {dateShort}',
    subjectToday: 'Reserva para hoje: {tourName}',
    subjectTomorrow: 'Reserva para amanhã: {tourName}',
  },
  [Locale.zh]: {
    subject: '预订成功:{dateShort} {tourName}',
    subjectToday: '今天出发:{tourName}',
    subjectTomorrow: '明天出发:{tourName}',
  },
};
