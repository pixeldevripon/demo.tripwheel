import { Locale } from '@prisma/client';

/**
 * MK-1 "Next adventure" copy, 7 locales (EMAIL-IMPLEMENTATION-PLAN.md §2.9,
 * checklist G-08).
 *
 * English is CANONICAL and locked to the funnel wireframe's embedded MK-1
 * template (technical-doc/emails/island-tours-email-funnel-wireframe.html,
 * `tpl-next` + its subject bar); the other six are machine-first translations
 * awaiting a native pass. Strings with `{slots}` are interpolated by
 * `buildNextAdventureEmailContext()` via `fillCopy` — the HTML template only
 * ever sees finished sentences.
 *
 * Subject A ships. `subjectB` is deliberately present and UNUSED — the
 * wireframe defines it as the future A/B arm, and keeping it here means the
 * eventual experiment is a one-line change in the sender, not a copy hunt
 * (plan §4 WP-G-2: "A/B testing out of scope", the field is not).
 *
 * HARD negative rules (wireframe, asserted in the render spec): no discount,
 * no countdown, no scarcity ("only N spots left") anywhere in this module.
 * The one availability sentence allowed is `fillNote` — a general truth about
 * island boats, not a per-tour scarcity claim.
 */
export interface NextAdventureCopy {
  /** Subject A (ships): "Where our guides send people after {tourName}". */
  subjectA: string;
  /** Subject B (future A/B arm, unused): "Open departures this week on {island}". */
  subjectB: string;
  /** Inbox preview. */
  preview: string;
  /** "Still have days left on the island?" */
  headline: string;
  /**
   * Intro sentence, split around the bold booked-tour name so each locale
   * controls where the name sits in the sentence.
   */
  introBeforeTourName: string;
  introAfterTourName: string;
  /** "Already home? Save them for the next trip." */
  alreadyHome: string;
  /** "Open:" — precedes the card's open-days list. */
  openPrefix: string;
  /** "daily" — when the tour has open departures every day of the week. */
  openDaily: string;
  /** "from" — precedes the bold from-price on a card ("from $89"). */
  fromLabel: string;
  /** "{hours} hrs" — card duration, whole/decimal hours. */
  hoursShort: string;
  /** "{minutes} min" — card duration under an hour. */
  minutesShort: string;
  /** "See times" — the card CTA (the › lives in the markup). */
  seeTimes: string;
  /** "Most boats leave before 8am and fill up a day or two ahead." */
  fillNote: string;
  /** "See all {count} tours on {island}" (the › lives in the markup). */
  seeAllLabel: string;
  /** Bold lead of the free-reschedule line. */
  rescheduleBold: string;
  /** The rest of the free-reschedule line. */
  rescheduleRest: string;
  /**
   * Marketing footer, split around the bold booked-tour name:
   * "You are getting this because you booked {tourName} with Island Tours.
   *  Your booking emails always arrive."
   */
  footerBeforeTourName: string;
  footerAfterTourName: string;
  /** "Unsubscribe" */
  unsubscribeLabel: string;
  /** "Get fewer emails" */
  fewerEmailsLabel: string;
}

export const NEXT_ADVENTURE_COPY: Record<Locale, NextAdventureCopy> = {
  [Locale.en]: {
    subjectA: 'Where our guides send people after {tourName}',
    subjectB: 'Open departures this week on {island}',
    preview:
      'Three with spots open this week. Already home? Save them for next time.',
    headline: 'Still have days left on the island?',
    introBeforeTourName:
      'These three have open departures this week, and they are the ones we would send our own friends to after ',
    introAfterTourName: '.',
    alreadyHome: 'Already home? Save them for the next trip.',
    openPrefix: 'Open:',
    openDaily: 'daily',
    fromLabel: 'from',
    hoursShort: '{hours} hrs',
    minutesShort: '{minutes} min',
    seeTimes: 'See times',
    fillNote: 'Most boats leave before 8am and fill up a day or two ahead.',
    seeAllLabel: 'See all {count} tours on {island}',
    rescheduleBold: 'Free reschedule up to 24 hours before departure.',
    rescheduleRest: 'Plans on a holiday change. That is fine.',
    footerBeforeTourName: 'You are getting this because you booked ',
    footerAfterTourName:
      ' with Island Tours. Your booking emails always arrive.',
    unsubscribeLabel: 'Unsubscribe',
    fewerEmailsLabel: 'Get fewer emails',
  },
  [Locale.nl]: {
    subjectA: 'Waar onze gidsen mensen heen sturen na {tourName}',
    subjectB: 'Open vertrektijden deze week op {island}',
    preview:
      'Drie met open plekken deze week. Al thuis? Bewaar ze voor de volgende keer.',
    headline: 'Nog dagen over op het eiland?',
    introBeforeTourName:
      'Deze drie hebben deze week open vertrektijden, en het zijn de tours waar we onze eigen vrienden heen zouden sturen na ',
    introAfterTourName: '.',
    alreadyHome: 'Al thuis? Bewaar ze voor de volgende reis.',
    openPrefix: 'Open:',
    openDaily: 'dagelijks',
    fromLabel: 'vanaf',
    hoursShort: '{hours} uur',
    minutesShort: '{minutes} min',
    seeTimes: 'Bekijk tijden',
    fillNote:
      'De meeste boten vertrekken voor 8 uur en zitten een dag of twee van tevoren vol.',
    seeAllLabel: 'Bekijk alle {count} tours op {island}',
    rescheduleBold: 'Gratis omboeken tot 24 uur voor vertrek.',
    rescheduleRest: 'Plannen veranderen op vakantie. Dat is prima.',
    footerBeforeTourName: 'Je ontvangt dit omdat je ',
    footerAfterTourName:
      ' hebt geboekt bij Island Tours. Je boekingsmails komen altijd aan.',
    unsubscribeLabel: 'Uitschrijven',
    fewerEmailsLabel: 'Minder e-mails ontvangen',
  },
  [Locale.de]: {
    subjectA: 'Wohin unsere Guides nach {tourName} schicken',
    subjectB: 'Offene Abfahrten diese Woche auf {island}',
    preview:
      'Drei mit freien Plätzen diese Woche. Schon zu Hause? Merk sie dir für das nächste Mal.',
    headline: 'Noch Tage auf der Insel übrig?',
    introBeforeTourName:
      'Diese drei haben diese Woche offene Abfahrten, und es sind die Touren, zu denen wir unsere eigenen Freunde nach ',
    introAfterTourName: ' schicken würden.',
    alreadyHome: 'Schon zu Hause? Merk sie dir für die nächste Reise.',
    openPrefix: 'Offen:',
    openDaily: 'täglich',
    fromLabel: 'ab',
    hoursShort: '{hours} Std.',
    minutesShort: '{minutes} Min.',
    seeTimes: 'Zeiten ansehen',
    fillNote:
      'Die meisten Boote legen vor 8 Uhr ab und sind ein bis zwei Tage vorher voll.',
    seeAllLabel: 'Alle {count} Touren auf {island} ansehen',
    rescheduleBold: 'Kostenloses Umbuchen bis 24 Stunden vor Abfahrt.',
    rescheduleRest: 'Pläne ändern sich im Urlaub. Das ist völlig in Ordnung.',
    footerBeforeTourName: 'Du erhältst diese E-Mail, weil du ',
    footerAfterTourName:
      ' bei Island Tours gebucht hast. Deine Buchungs-E-Mails kommen immer an.',
    unsubscribeLabel: 'Abmelden',
    fewerEmailsLabel: 'Weniger E-Mails erhalten',
  },
  [Locale.fr]: {
    subjectA: 'Où nos guides envoient les gens après {tourName}',
    subjectB: 'Départs ouverts cette semaine sur {island}',
    preview:
      'Trois avec des places cette semaine. Déjà rentré ? Gardez-les pour la prochaine fois.',
    headline: "Encore quelques jours sur l'île ?",
    introBeforeTourName:
      'Ces trois-là ont des départs ouverts cette semaine, et ce sont ceux où nous enverrions nos propres amis après ',
    introAfterTourName: '.',
    alreadyHome: 'Déjà rentré ? Gardez-les pour le prochain voyage.',
    openPrefix: 'Ouvert :',
    openDaily: 'tous les jours',
    fromLabel: 'dès',
    hoursShort: '{hours} h',
    minutesShort: '{minutes} min',
    seeTimes: 'Voir les horaires',
    fillNote:
      'La plupart des bateaux partent avant 8h et se remplissent un à deux jours à l’avance.',
    seeAllLabel: 'Voir les {count} tours sur {island}',
    rescheduleBold: 'Report gratuit jusqu’à 24 heures avant le départ.',
    rescheduleRest: 'Les plans changent en vacances. Ce n’est pas grave.',
    footerBeforeTourName:
      'Vous recevez cet e-mail parce que vous avez réservé ',
    footerAfterTourName:
      ' avec Island Tours. Vos e-mails de réservation arrivent toujours.',
    unsubscribeLabel: 'Se désabonner',
    fewerEmailsLabel: 'Recevoir moins d’e-mails',
  },
  [Locale.es]: {
    subjectA: 'Adónde mandan nuestros guías después de {tourName}',
    subjectB: 'Salidas abiertas esta semana en {island}',
    preview:
      'Tres con plazas esta semana. ¿Ya en casa? Guárdalos para la próxima.',
    headline: '¿Todavía te quedan días en la isla?',
    introBeforeTourName:
      'Estos tres tienen salidas abiertas esta semana, y son a los que mandaríamos a nuestros propios amigos después de ',
    introAfterTourName: '.',
    alreadyHome: '¿Ya en casa? Guárdalos para el próximo viaje.',
    openPrefix: 'Abierto:',
    openDaily: 'a diario',
    fromLabel: 'desde',
    hoursShort: '{hours} h',
    minutesShort: '{minutes} min',
    seeTimes: 'Ver horarios',
    fillNote:
      'La mayoría de los barcos salen antes de las 8 y se llenan con uno o dos días de antelación.',
    seeAllLabel: 'Ver los {count} tours en {island}',
    rescheduleBold: 'Cambio de fecha gratis hasta 24 horas antes de la salida.',
    rescheduleRest: 'Los planes cambian en vacaciones. No pasa nada.',
    footerBeforeTourName: 'Recibes este correo porque reservaste ',
    footerAfterTourName:
      ' con Island Tours. Tus correos de reserva siempre llegan.',
    unsubscribeLabel: 'Darse de baja',
    fewerEmailsLabel: 'Recibir menos correos',
  },
  [Locale.pt]: {
    subjectA:
      'Para onde os nossos guias mandam as pessoas depois de {tourName}',
    subjectB: 'Partidas abertas esta semana em {island}',
    preview:
      'Três com vagas esta semana. Já em casa? Guarde-os para a próxima.',
    headline: 'Ainda tem dias na ilha?',
    introBeforeTourName:
      'Estes três têm partidas abertas esta semana, e são aqueles para onde mandaríamos os nossos próprios amigos depois de ',
    introAfterTourName: '.',
    alreadyHome: 'Já em casa? Guarde-os para a próxima viagem.',
    openPrefix: 'Aberto:',
    openDaily: 'todos os dias',
    fromLabel: 'desde',
    hoursShort: '{hours} h',
    minutesShort: '{minutes} min',
    seeTimes: 'Ver horários',
    fillNote:
      'A maioria dos barcos parte antes das 8h e esgota um ou dois dias antes.',
    seeAllLabel: 'Ver todos os {count} tours em {island}',
    rescheduleBold: 'Remarcação gratuita até 24 horas antes da partida.',
    rescheduleRest: 'Os planos mudam de férias. Não faz mal.',
    footerBeforeTourName: 'Está a receber este e-mail porque reservou ',
    footerAfterTourName:
      ' com a Island Tours. Os seus e-mails de reserva chegam sempre.',
    unsubscribeLabel: 'Cancelar subscrição',
    fewerEmailsLabel: 'Receber menos e-mails',
  },
  [Locale.zh]: {
    subjectA: '{tourName} 之后,我们的向导会推荐这些',
    subjectB: '本周 {island} 有空位的行程',
    preview: '本周有空位的三个行程。已经回家了?留着下次用。',
    headline: '在岛上还有几天时间?',
    introBeforeTourName: '这三个行程本周都有空位,也是我们在 ',
    introAfterTourName: ' 之后会推荐给自己朋友的行程。',
    alreadyHome: '已经回家了?留着下次旅行用。',
    openPrefix: '开放:',
    openDaily: '每天',
    fromLabel: '低至',
    hoursShort: '{hours} 小时',
    minutesShort: '{minutes} 分钟',
    seeTimes: '查看时间',
    fillNote: '大多数船在早上 8 点前出发,提前一两天就会订满。',
    seeAllLabel: '查看 {island} 全部 {count} 个行程',
    rescheduleBold: '出发前 24 小时内可免费改期。',
    rescheduleRest: '度假时计划有变很正常,没关系。',
    footerBeforeTourName: '您收到这封邮件,是因为您在 Island Tours 预订了 ',
    footerAfterTourName: '。您的预订邮件始终都会送达。',
    unsubscribeLabel: '退订',
    fewerEmailsLabel: '减少邮件',
  },
};
