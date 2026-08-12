import { Locale } from '@prisma/client';

/**
 * BK-2 pre-tour reminder copy, 7 locales (EMAIL-IMPLEMENTATION-PLAN.md §2.9).
 *
 * English is CANONICAL and locked to the funnel wireframe's embedded BK-2
 * template (technical-doc/emails/island-tours-email-funnel-wireframe.html,
 * `tpl-remind`); the other six are machine-first translations awaiting a
 * native pass. Strings with `{slots}` are interpolated by
 * `buildReminderEmailContext()` via `fillCopy` - the HTML template only ever
 * sees finished sentences.
 *
 * The "today" variant (wireframe rule: subject and greeting switch when the
 * T-24h fire lands on the tour date in tour-local time) is a copy-level
 * switch, so it lives here as `…Today` siblings rather than as an `[IF]` in
 * the design-owned template.
 */
export interface PreTourReminderCopy {
  /** "Tomorrow: {tourName} · {startTime}" - subject, T-24h fire. */
  subjectTomorrow: string;
  /** Same-day variant of the subject. */
  subjectToday: string;
  /** Subject when the booking snapshot carries no start time. */
  subjectTomorrowNoTime: string;
  subjectTodayNoTime: string;
  /** Inbox preview when pickup is set: names time + place. */
  previewPickup: string;
  /** Inbox preview fallback (meeting-point bookings). */
  preview: string;
  /** "You're set for tomorrow, {firstName}." */
  headlineTomorrow: string;
  headlineToday: string;
  /** "{tourName} · tomorrow at" - the bold start time follows in markup. */
  subLinePrefixTomorrow: string;
  subLinePrefixToday: string;
  /** "(local time)" */
  localTimeSuffix: string;
  /** "Booking reference:" */
  refLabel: string;
  /** "Pickup:" */
  pickupLabel: string;
  /** "be ready at" - precedes the bold pickup time. */
  beReadyAt: string;
  /** "Meeting point:" */
  meetingPointLabel: string;
  /** "Please arrive {minutes} minutes early." - meeting-point bookings. */
  arriveEarly: string;
  /** "Open in Maps" */
  openInMaps: string;
  /** "Duration: {duration}" */
  durationLine: string;
  /** "Duration: {duration}, back around {endTime}" */
  durationLineWithReturn: string;
  /** "What to bring" */
  whatToBringTitle: string;
  /** "Remaining balance" - operator_link only, hidden at zero. */
  balanceTitle: string;
  /**
   * The balance note, SPLIT around the amount so the template can bold it:
   * `{balanceNotePrefix} <b>{balanceAmount}</b> {balanceNoteSuffix}`.
   *
   * It is split rather than interpolated because the renderer HTML-escapes
   * every `{token}` (email-template.renderer.ts) - a `<b>` inside a copy
   * string can only ever render as literal `&lt;b&gt;`, which is how the
   * wireframe's bold amount went missing. Markup lives in the template.
   *
   * Locales place the amount differently, so each one carries its own
   * natural split point rather than the English shape.
   *
   * NEVER a link and never a nudge beyond this wording - the wireframe's
   * anti-phishing rule.
   */
  balanceNotePrefix: string;
  /** The rest of the sentence after the amount ({operator}). */
  balanceNoteSuffix: string;
  /** Weather-dependent tours only ({operator}). */
  weatherNote: string;
  /** "Questions about tomorrow?" */
  questionsTitleTomorrow: string;
  questionsTitleToday: string;
  /** "Talk to the locals running it:" - the bold operator name follows. */
  talkToLocals: string;
  /** "Booking or platform issue?" - precedes the WhatsApp link. */
  platformIssue: string;
  /** "WhatsApp us" - the link label. */
  whatsappUs: string;
  /** ", daily 08:00 to 20:00." - follows the WhatsApp link. */
  supportHours: string;

  // ── "Islanders also love..." cross-sell rail + its marketing footer ────────
  // Soft-opt-in MARKETING inventory inside a transactional email, so the rail
  // and the unsubscribe footer line SHIP TOGETHER: the copy promises an
  // opt-out, and an opt-out with no way to act on it is the compliance
  // failure. Both hide together when there are no picks.

  /** "Islanders also love..." - the rail heading. */
  railTitle: string;
  /** "Picked to pair with your booking" */
  railSubhead: string;
  /** "from" - precedes the bold card price. */
  railFromLabel: string;
  /** "Open departures this week" - true by construction (see the loader). */
  railOpenThisWeek: string;
  /** "Browse the Islanders' top picks" - the rail's single link. */
  railCta: string;
  /** "You get these picks as an Island Tours guest." */
  picksNotePrefix: string;
  /** "Unsubscribe from offers" - the MARKETING-stream opt-out link label. */
  unsubscribeLabel: string;
  /** "(your booking emails always arrive)." */
  picksNoteSuffix: string;
}

export const PRE_TOUR_REMINDER_COPY: Record<Locale, PreTourReminderCopy> = {
  [Locale.en]: {
    subjectTomorrow: 'Tomorrow: {tourName} · {startTime}',
    subjectToday: 'Today: {tourName} · {startTime}',
    subjectTomorrowNoTime: 'Tomorrow: {tourName}',
    subjectTodayNoTime: 'Today: {tourName}',
    previewPickup:
      'Pickup at {pickupTime} from {pickupLocation}. Your reference, what to bring, and who to call.',
    preview: 'Your reference, what to bring, and who to call.',
    headlineTomorrow: "You're set for tomorrow, {firstName}.",
    headlineToday: "You're set for today, {firstName}.",
    subLinePrefixTomorrow: '{tourName} · tomorrow at',
    subLinePrefixToday: '{tourName} · today at',
    localTimeSuffix: '(local time)',
    refLabel: 'Booking reference:',
    pickupLabel: 'Pickup:',
    beReadyAt: 'be ready at',
    meetingPointLabel: 'Meeting point:',
    arriveEarly: 'Please arrive {minutes} minutes early.',
    openInMaps: 'Open in Maps',
    durationLine: 'Duration: {duration}',
    durationLineWithReturn: 'Duration: {duration}, back around {endTime}',
    whatToBringTitle: 'What to bring',
    balanceTitle: 'Remaining balance',
    balanceNotePrefix: 'Your remaining balance of',
    balanceNoteSuffix:
      "runs through {operator}'s payment link. Already paid? You're all set. Not yet? Find the link in their email, or contact them below.",
    weatherNote:
      '{operator} watches the weather and contacts you directly if conditions force a change. If the operator cancels: a full refund or a free reschedule, always.',
    questionsTitleTomorrow: 'Questions about tomorrow?',
    questionsTitleToday: 'Questions about today?',
    talkToLocals: 'Talk to the locals running it:',
    platformIssue: 'Booking or platform issue?',
    whatsappUs: 'WhatsApp us',
    supportHours: ', daily 08:00 to 20:00.',
    railTitle: 'Islanders also love...',
    railSubhead: 'Picked to pair with your booking',
    railFromLabel: 'from',
    railOpenThisWeek: 'Open departures this week',
    railCta: "Browse the Islanders' top picks",
    picksNotePrefix: 'You get these picks as an Island Tours guest.',
    unsubscribeLabel: 'Unsubscribe from offers',
    picksNoteSuffix: '(your booking emails always arrive).',
  },
  [Locale.nl]: {
    subjectTomorrow: 'Morgen: {tourName} · {startTime}',
    subjectToday: 'Vandaag: {tourName} · {startTime}',
    subjectTomorrowNoTime: 'Morgen: {tourName}',
    subjectTodayNoTime: 'Vandaag: {tourName}',
    previewPickup:
      'Ophalen om {pickupTime} bij {pickupLocation}. Je referentie, wat je meeneemt en wie je kunt bellen.',
    preview: 'Je referentie, wat je meeneemt en wie je kunt bellen.',
    headlineTomorrow: 'Morgen is het zover, {firstName}.',
    headlineToday: 'Vandaag is het zover, {firstName}.',
    subLinePrefixTomorrow: '{tourName} · morgen om',
    subLinePrefixToday: '{tourName} · vandaag om',
    localTimeSuffix: '(lokale tijd)',
    refLabel: 'Boekingsreferentie:',
    pickupLabel: 'Ophalen:',
    beReadyAt: 'sta klaar om',
    meetingPointLabel: 'Verzamelpunt:',
    arriveEarly: 'Kom {minutes} minuten eerder.',
    openInMaps: 'Open in Maps',
    durationLine: 'Duur: {duration}',
    durationLineWithReturn: 'Duur: {duration}, rond {endTime} terug',
    whatToBringTitle: 'Wat neem je mee',
    balanceTitle: 'Openstaand saldo',
    balanceNotePrefix: 'Je resterende saldo van',
    balanceNoteSuffix:
      'loopt via de betaallink van {operator}. Al betaald? Dan ben je klaar. Nog niet? Je vindt de link in hun e-mail, of neem hieronder contact met ze op.',
    weatherNote:
      '{operator} houdt het weer in de gaten en neemt direct contact met je op als de omstandigheden een wijziging afdwingen. Annuleert de operator? Dan altijd een volledige terugbetaling of gratis omboeken.',
    questionsTitleTomorrow: 'Vragen over morgen?',
    questionsTitleToday: 'Vragen over vandaag?',
    talkToLocals: 'Vraag het de locals die de tour draaien:',
    platformIssue: 'Vraag over je boeking of het platform?',
    whatsappUs: 'Stuur ons een WhatsApp',
    supportHours: ', dagelijks 08:00 tot 20:00.',
    railTitle: 'Locals houden ook van...',
    railSubhead: 'Gekozen om bij je boeking te passen',
    railFromLabel: 'vanaf',
    railOpenThisWeek: 'Deze week open vertrektijden',
    railCta: 'Bekijk de topkeuzes van de locals',
    picksNotePrefix: 'Je krijgt deze tips als gast van Island Tours.',
    unsubscribeLabel: 'Afmelden voor aanbiedingen',
    picksNoteSuffix: '(je boekingsmails komen altijd aan).',
  },
  [Locale.de]: {
    subjectTomorrow: 'Morgen: {tourName} · {startTime}',
    subjectToday: 'Heute: {tourName} · {startTime}',
    subjectTomorrowNoTime: 'Morgen: {tourName}',
    subjectTodayNoTime: 'Heute: {tourName}',
    previewPickup:
      'Abholung um {pickupTime} ab {pickupLocation}. Deine Referenz, was du mitbringst und wen du anrufen kannst.',
    preview: 'Deine Referenz, was du mitbringst und wen du anrufen kannst.',
    headlineTomorrow: 'Morgen geht es los, {firstName}.',
    headlineToday: 'Heute geht es los, {firstName}.',
    subLinePrefixTomorrow: '{tourName} · morgen um',
    subLinePrefixToday: '{tourName} · heute um',
    localTimeSuffix: '(Ortszeit)',
    refLabel: 'Buchungsreferenz:',
    pickupLabel: 'Abholung:',
    beReadyAt: 'sei bereit um',
    meetingPointLabel: 'Treffpunkt:',
    arriveEarly: 'Bitte sei {minutes} Minuten früher da.',
    openInMaps: 'In Maps öffnen',
    durationLine: 'Dauer: {duration}',
    durationLineWithReturn: 'Dauer: {duration}, zurück gegen {endTime}',
    whatToBringTitle: 'Was du mitbringst',
    balanceTitle: 'Offener Restbetrag',
    balanceNotePrefix: 'Dein Restbetrag von',
    balanceNoteSuffix:
      'läuft über den Zahlungslink von {operator}. Schon bezahlt? Dann ist alles erledigt. Noch nicht? Den Link findest du in deren E-Mail, oder melde dich unten direkt.',
    weatherNote:
      '{operator} behält das Wetter im Blick und meldet sich direkt bei dir, wenn die Bedingungen eine Änderung erzwingen. Sagt der Veranstalter ab: immer volle Rückerstattung oder kostenloses Umbuchen.',
    questionsTitleTomorrow: 'Fragen zu morgen?',
    questionsTitleToday: 'Fragen zu heute?',
    talkToLocals: 'Frag die Locals, die die Tour fahren:',
    platformIssue: 'Frage zur Buchung oder zur Plattform?',
    whatsappUs: 'Schreib uns auf WhatsApp',
    supportHours: ', täglich 08:00 bis 20:00.',
    railTitle: 'Locals lieben außerdem...',
    railSubhead: 'Passend zu deiner Buchung ausgewählt',
    railFromLabel: 'ab',
    railOpenThisWeek: 'Diese Woche freie Abfahrten',
    railCta: 'Die Top-Tipps der Locals ansehen',
    picksNotePrefix: 'Du bekommst diese Tipps als Gast von Island Tours.',
    unsubscribeLabel: 'Angebote abbestellen',
    picksNoteSuffix: '(deine Buchungs-E-Mails kommen immer an).',
  },
  [Locale.fr]: {
    subjectTomorrow: 'Demain : {tourName} · {startTime}',
    subjectToday: "Aujourd'hui : {tourName} · {startTime}",
    subjectTomorrowNoTime: 'Demain : {tourName}',
    subjectTodayNoTime: "Aujourd'hui : {tourName}",
    previewPickup:
      'Prise en charge à {pickupTime} depuis {pickupLocation}. Votre référence, quoi apporter et qui appeler.',
    preview: 'Votre référence, quoi apporter et qui appeler.',
    headlineTomorrow: "C'est pour demain, {firstName}.",
    headlineToday: "C'est pour aujourd'hui, {firstName}.",
    subLinePrefixTomorrow: '{tourName} · demain à',
    subLinePrefixToday: "{tourName} · aujourd'hui à",
    localTimeSuffix: '(heure locale)',
    refLabel: 'Référence de réservation :',
    pickupLabel: 'Prise en charge :',
    beReadyAt: 'soyez prêt à',
    meetingPointLabel: 'Point de rendez-vous :',
    arriveEarly: "Merci d'arriver {minutes} minutes en avance.",
    openInMaps: 'Ouvrir dans Maps',
    durationLine: 'Durée : {duration}',
    durationLineWithReturn: 'Durée : {duration}, retour vers {endTime}',
    whatToBringTitle: 'À apporter',
    balanceTitle: 'Solde restant',
    balanceNotePrefix: 'Votre solde restant de',
    balanceNoteSuffix:
      'passe par le lien de paiement de {operator}. Déjà réglé ? Tout est en ordre. Pas encore ? Le lien est dans leur e-mail, ou contactez-les ci-dessous.',
    weatherNote:
      "{operator} surveille la météo et vous contacte directement si les conditions imposent un changement. Si l'opérateur annule : remboursement intégral ou report gratuit, toujours.",
    questionsTitleTomorrow: 'Des questions pour demain ?',
    questionsTitleToday: "Des questions pour aujourd'hui ?",
    talkToLocals: 'Parlez aux locaux qui organisent la sortie :',
    platformIssue: 'Question sur la réservation ou la plateforme ?',
    whatsappUs: 'Écrivez-nous sur WhatsApp',
    supportHours: ', tous les jours de 08:00 à 20:00.',
    railTitle: 'Les locaux aiment aussi...',
    railSubhead: 'Choisis pour compléter votre réservation',
    railFromLabel: 'dès',
    railOpenThisWeek: 'Départs ouverts cette semaine',
    railCta: 'Voir les coups de cœur des locaux',
    picksNotePrefix:
      'Vous recevez ces suggestions en tant que client Island Tours.',
    unsubscribeLabel: 'Se désabonner des offres',
    picksNoteSuffix: '(vos e-mails de réservation arrivent toujours).',
  },
  [Locale.es]: {
    subjectTomorrow: 'Mañana: {tourName} · {startTime}',
    subjectToday: 'Hoy: {tourName} · {startTime}',
    subjectTomorrowNoTime: 'Mañana: {tourName}',
    subjectTodayNoTime: 'Hoy: {tourName}',
    previewPickup:
      'Recogida a las {pickupTime} en {pickupLocation}. Tu referencia, qué llevar y a quién llamar.',
    preview: 'Tu referencia, qué llevar y a quién llamar.',
    headlineTomorrow: 'Mañana es el día, {firstName}.',
    headlineToday: 'Hoy es el día, {firstName}.',
    subLinePrefixTomorrow: '{tourName} · mañana a las',
    subLinePrefixToday: '{tourName} · hoy a las',
    localTimeSuffix: '(hora local)',
    refLabel: 'Referencia de la reserva:',
    pickupLabel: 'Recogida:',
    beReadyAt: 'estate listo a las',
    meetingPointLabel: 'Punto de encuentro:',
    arriveEarly: 'Llega {minutes} minutos antes.',
    openInMaps: 'Abrir en Maps',
    durationLine: 'Duración: {duration}',
    durationLineWithReturn: 'Duración: {duration}, vuelta hacia las {endTime}',
    whatToBringTitle: 'Qué llevar',
    balanceTitle: 'Saldo pendiente',
    balanceNotePrefix: 'Tu saldo pendiente de',
    balanceNoteSuffix:
      'se paga a través del enlace de pago de {operator}. ¿Ya pagaste? Todo listo. ¿Todavía no? Encuentra el enlace en su correo o contáctalos abajo.',
    weatherNote:
      '{operator} vigila el tiempo y te contacta directamente si las condiciones obligan a un cambio. Si el operador cancela: siempre reembolso completo o cambio de fecha gratis.',
    questionsTitleTomorrow: '¿Preguntas sobre mañana?',
    questionsTitleToday: '¿Preguntas sobre hoy?',
    talkToLocals: 'Habla con los locales que llevan el tour:',
    platformIssue: '¿Algo de la reserva o de la plataforma?',
    whatsappUs: 'Escríbenos por WhatsApp',
    supportHours: ', todos los días de 08:00 a 20:00.',
    railTitle: 'A los locales también les encanta...',
    railSubhead: 'Elegidos para combinar con tu reserva',
    railFromLabel: 'desde',
    railOpenThisWeek: 'Salidas abiertas esta semana',
    railCta: 'Ver las recomendaciones de los locales',
    picksNotePrefix:
      'Recibes estas recomendaciones como huésped de Island Tours.',
    unsubscribeLabel: 'Darse de baja de las ofertas',
    picksNoteSuffix: '(tus correos de reserva siempre llegan).',
  },
  [Locale.pt]: {
    subjectTomorrow: 'Amanhã: {tourName} · {startTime}',
    subjectToday: 'Hoje: {tourName} · {startTime}',
    subjectTomorrowNoTime: 'Amanhã: {tourName}',
    subjectTodayNoTime: 'Hoje: {tourName}',
    previewPickup:
      'Recolha às {pickupTime} em {pickupLocation}. A sua referência, o que levar e a quem ligar.',
    preview: 'A sua referência, o que levar e a quem ligar.',
    headlineTomorrow: 'Amanhã é o grande dia, {firstName}.',
    headlineToday: 'Hoje é o grande dia, {firstName}.',
    subLinePrefixTomorrow: '{tourName} · amanhã às',
    subLinePrefixToday: '{tourName} · hoje às',
    localTimeSuffix: '(hora local)',
    refLabel: 'Referência da reserva:',
    pickupLabel: 'Recolha:',
    beReadyAt: 'esteja pronto às',
    meetingPointLabel: 'Ponto de encontro:',
    arriveEarly: 'Chegue {minutes} minutos mais cedo.',
    openInMaps: 'Abrir no Maps',
    durationLine: 'Duração: {duration}',
    durationLineWithReturn:
      'Duração: {duration}, regresso por volta das {endTime}',
    whatToBringTitle: 'O que levar',
    balanceTitle: 'Saldo por pagar',
    balanceNotePrefix: 'O seu saldo restante de',
    balanceNoteSuffix:
      'é pago através do link de pagamento de {operator}. Já pagou? Está tudo tratado. Ainda não? Encontre o link no e-mail deles ou contacte-os abaixo.',
    weatherNote:
      '{operator} acompanha o tempo e contacta-o diretamente se as condições obrigarem a uma alteração. Se o operador cancelar: reembolso total ou remarcação gratuita, sempre.',
    questionsTitleTomorrow: 'Dúvidas sobre amanhã?',
    questionsTitleToday: 'Dúvidas sobre hoje?',
    talkToLocals: 'Fale com os locais que fazem o tour:',
    platformIssue: 'Questões sobre a reserva ou a plataforma?',
    whatsappUs: 'Fale connosco no WhatsApp',
    supportHours: ', todos os dias das 08:00 às 20:00.',
    railTitle: 'Os locais também adoram...',
    railSubhead: 'Escolhidos para combinar com a sua reserva',
    railFromLabel: 'desde',
    railOpenThisWeek: 'Partidas abertas esta semana',
    railCta: 'Ver as escolhas dos locais',
    picksNotePrefix: 'Recebe estas sugestões como cliente da Island Tours.',
    unsubscribeLabel: 'Cancelar a subscrição das ofertas',
    picksNoteSuffix: '(os seus e-mails de reserva chegam sempre).',
  },
  [Locale.zh]: {
    subjectTomorrow: '明天:{tourName} · {startTime}',
    subjectToday: '今天:{tourName} · {startTime}',
    subjectTomorrowNoTime: '明天:{tourName}',
    subjectTodayNoTime: '今天:{tourName}',
    previewPickup:
      '{pickupTime} 在 {pickupLocation} 接您。您的预订编号、需要携带的物品以及联系方式。',
    preview: '您的预订编号、需要携带的物品以及联系方式。',
    headlineTomorrow: '{firstName},明天就出发了。',
    headlineToday: '{firstName},今天就出发了。',
    subLinePrefixTomorrow: '{tourName} · 明天',
    subLinePrefixToday: '{tourName} · 今天',
    localTimeSuffix: '(当地时间)',
    refLabel: '预订编号:',
    pickupLabel: '接送:',
    beReadyAt: '请在此时间前准备好:',
    meetingPointLabel: '集合点:',
    arriveEarly: '请提前 {minutes} 分钟到达。',
    openInMaps: '在地图中打开',
    durationLine: '时长:{duration}',
    durationLineWithReturn: '时长:{duration},约 {endTime} 返回',
    whatToBringTitle: '需要携带',
    balanceTitle: '待付余款',
    balanceNotePrefix: '您的余款',
    balanceNoteSuffix:
      '通过 {operator} 的付款链接支付。已付款?一切就绪。还没有?请在他们的邮件中查找链接,或通过下方方式联系他们。',
    weatherNote:
      '{operator} 会关注天气情况,如条件迫使行程变更,他们会直接联系您。如运营方取消:一律全额退款或免费改期。',
    questionsTitleTomorrow: '对明天的行程有疑问?',
    questionsTitleToday: '对今天的行程有疑问?',
    talkToLocals: '联系带队的当地团队:',
    platformIssue: '预订或平台问题?',
    whatsappUs: '通过 WhatsApp 联系我们',
    supportHours: ',每天 08:00 至 20:00。',
    railTitle: '当地人也喜欢...',
    railSubhead: '为搭配您的预订而精选',
    railFromLabel: '低至',
    railOpenThisWeek: '本周有开放的出发班次',
    railCta: '浏览当地人的精选推荐',
    picksNotePrefix: '您作为 Island Tours 的客人收到这些推荐。',
    unsubscribeLabel: '退订推荐邮件',
    picksNoteSuffix: '(您的预订邮件始终都会送达。)',
  },
};
