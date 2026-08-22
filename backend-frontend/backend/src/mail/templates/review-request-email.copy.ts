import { Locale } from '@prisma/client';

/**
 * BK-3 review request + BK-3R review reminder copy, 7 locales
 * (EMAIL-IMPLEMENTATION-PLAN.md §2.9, checklist B-10/B-12).
 *
 * BK-3 English is the DECIDED copy, word for word from the funnel wireframe
 * (`technical-doc/emails/island-tours-email-funnel-wireframe.html`,
 * `tpl-review`): autonomy cue, outward favor, the NAMED operator as
 * beneficiary, ease last. It is deliberately a set of per-BLOCK strings rather
 * than a paragraph array - the nine-block layout puts the greeting, the ask,
 * the star prompt, the disclosure and the sign-off in different cells at
 * different sizes, so a flat array could not address them.
 *
 * BK-3R English is the WP-B DRAFT awaiting founder sign-off (decision D1) -
 * distinct from BK-3, deliberately lighter, and explicit that it is the one and
 * only reminder. It stays a paragraph ARRAY on purpose: the draft is
 * founder-approved as written and re-slotting it into per-block strings would
 * be rewriting it. The context builder maps paragraph 1 into the greeting cell
 * and the rest into the ask cell.
 *
 * The other six locales are machine-first translations of both (decision D5).
 *
 * `{slots}`: firstName, tourName, operatorName/operatorTeam (the operator's
 * company name, falling back to the locale's `operatorFallback` when none is on
 * file), dateLong, bookingRef.
 *
 * Strings NEVER carry markup: the template renderer HTML-escapes every token,
 * so a `<b>` in a copy string would render as literal text. Wherever the design
 * bolds part of a sentence, the copy is split into a Before/After pair around
 * the bolded token (the MK-1 `introBeforeTourName` pattern).
 */
export interface ReviewRequestCopy {
  /** "How was {tourName}?" */
  subject: string;
  /**
   * Inbox preview line. Deliberately NOT the subject: the old notice shell
   * used `{noticeTitle}` as its preheader, so the preview duplicated the
   * subject in every inbox.
   */
  preview: string;
  /** "Hi {firstName}," - the 22px greeting. */
  greeting: string;
  /** "We hope you had a great day." - the line under the greeting. */
  greetingLine: string;
  /** "Supplied by {operatorName} · your trip, {dateLong}" - the hero band. */
  heroSubline: string;
  /** "Booking reference:" - the booking card's label. */
  refLabel: string;
  /** The ask, up to (but excluding) the bolded operator name. */
  askBefore: string;
  /** The ask, from just after the bolded operator name. */
  askAfter: string;
  /** "Tap a star to start" - above the five stars. */
  tapAStar: string;
  /** "Rate your tour" - the CTA on both touches. */
  cta: string;
  /** UCPD Art 7(6) disclosure, line 1. */
  disclosureVerified: string;
  /** UCPD Art 7(6) disclosure, line 2. */
  disclosurePublishAll: string;
  /** "Masha danki, thank you from all of us." - both touches. */
  signoffThanks: string;
  /** "The Island Tours crew · Built by Islanders." */
  signoffTeam: string;
  /**
   * The transactional footer line. BK-3 is TRANSACTIONAL, so there is
   * deliberately no unsubscribe anywhere in this email - this line is the
   * provenance statement that replaces it.
   */
  footerLine: string;
  /** "Did you enjoy {tourName}?" */
  reminderSubject: string;
  /** Reminder paragraphs - the BK-3R draft, unchanged. */
  reminderParagraphs: string[];
  /**
   * Appended to the reminder ONLY when `reviewWhatsappOptIn` is set. The
   * WhatsApp send channel itself is not built - this only sets expectation.
   */
  reminderWhatsappLine: string;
  /** Stand-in for the operator name when none is on file. */
  operatorFallback: string;
}

export const REVIEW_REQUEST_COPY: Record<Locale, ReviewRequestCopy> = {
  [Locale.en]: {
    subject: 'How was {tourName}?',
    preview: 'A few words help the next traveler pick their tour.',
    greeting: 'Hi {firstName},',
    greetingLine: 'We hope you had a great day.',
    heroSubline: 'Supplied by {operatorName} · your trip, {dateShort}',
    refLabel: 'Booking reference:',
    askBefore:
      'If you have a minute, a few words on how it went helps the next traveler know what to expect, and it means a lot to ',
    askAfter: ' and the team. About thirty seconds is all it takes.',
    tapAStar: 'Tap a star to start',
    cta: 'Rate your tour',
    disclosureVerified:
      'Only guests who booked through Island Tours can review.',
    disclosurePublishAll: 'We publish every review, good or bad.',
    signoffThanks: 'Masha danki, thank you from all of us.',
    signoffTeam: 'The Island Tours crew · Built by Islanders.',
    footerLine:
      'You are receiving this because you took a tour booked through Island Tours. Booking reference {bookingRef}.',
    reminderSubject: 'Did you enjoy {tourName}?',
    reminderParagraphs: [
      'Hi {firstName}, one small nudge from us - the only one, promise.',
      'If {tourName} left you with a story, a star rating and a few words pass it on to the next traveller - and they mean a lot to {operatorTeam}.',
      'It takes about thirty seconds, and this is the last time we ask.',
    ],
    reminderWhatsappLine:
      'You opted in to WhatsApp updates, so the same review link may also reach you there - whichever is easier for you.',
    operatorFallback: 'the local crew who ran your day',
  },
  [Locale.nl]: {
    subject: 'Hoe was {tourName}?',
    preview:
      'Een paar woorden helpen de volgende reiziger bij het kiezen van hun tour.',
    greeting: 'Hoi {firstName},',
    greetingLine: 'We hopen dat je een geweldige dag hebt gehad.',
    heroSubline: 'Verzorgd door {operatorName} · je trip, {dateShort}',
    refLabel: 'Boekingsreferentie:',
    askBefore:
      'Als je even tijd hebt: een paar woorden over hoe het ging helpen de volgende reiziger te weten wat hij kan verwachten, en het betekent veel voor ',
    askAfter: ' en het team. Het kost ongeveer dertig seconden.',
    tapAStar: 'Tik op een ster om te beginnen',
    cta: 'Beoordeel je tour',
    disclosureVerified:
      'Alleen gasten die via Island Tours hebben geboekt, kunnen een review schrijven.',
    disclosurePublishAll: 'We publiceren elke review, goed of slecht.',
    signoffThanks: 'Masha danki, bedankt van ons allemaal.',
    signoffTeam: 'Het Island Tours-team · Built by Islanders.',
    footerLine:
      'Je ontvangt dit omdat je een tour hebt gemaakt die via Island Tours is geboekt. Boekingsreferentie {bookingRef}.',
    reminderSubject: 'Heb je genoten van {tourName}?',
    reminderParagraphs: [
      'Hoi {firstName}, nog één klein duwtje van ons - het enige, beloofd.',
      'Als {tourName} je een verhaal heeft opgeleverd, geven een sterrenscore en een paar woorden dat door aan de volgende reiziger - en ze betekenen veel voor {operatorTeam}.',
      'Het kost ongeveer dertig seconden, en dit is de laatste keer dat we het vragen.',
    ],
    reminderWhatsappLine:
      'Je hebt je aangemeld voor WhatsApp-updates, dus dezelfde reviewlink kan je daar ook bereiken - wat voor jou het makkelijkst is.',
    operatorFallback: 'de lokale crew die je dag draaide',
  },
  [Locale.de]: {
    subject: 'Wie war {tourName}?',
    preview:
      'Ein paar Worte helfen dem nächsten Reisenden bei der Wahl seiner Tour.',
    greeting: 'Hallo {firstName},',
    greetingLine: 'wir hoffen, du hattest einen großartigen Tag.',
    heroSubline: 'Durchgeführt von {operatorName} · deine Tour, {dateShort}',
    refLabel: 'Buchungsreferenz:',
    askBefore:
      'Wenn du eine Minute hast: ein paar Worte dazu, wie es war, helfen dem nächsten Reisenden zu wissen, was ihn erwartet - und sie bedeuten ',
    askAfter: ' und dem Team sehr viel. Es dauert etwa dreißig Sekunden.',
    tapAStar: 'Tippe auf einen Stern, um zu starten',
    cta: 'Tour bewerten',
    disclosureVerified:
      'Nur Gäste, die über Island Tours gebucht haben, können bewerten.',
    disclosurePublishAll:
      'Wir veröffentlichen jede Bewertung, gute wie schlechte.',
    signoffThanks: 'Masha danki, danke von uns allen.',
    signoffTeam: 'Das Island Tours Team · Built by Islanders.',
    footerLine:
      'Du erhältst diese E-Mail, weil du eine über Island Tours gebuchte Tour gemacht hast. Buchungsreferenz {bookingRef}.',
    reminderSubject: 'Hat dir {tourName} gefallen?',
    reminderParagraphs: [
      'Hallo {firstName}, ein kleiner Stups von uns - der einzige, versprochen.',
      'Wenn dir {tourName} eine Geschichte hinterlassen hat, geben eine Sternebewertung und ein paar Worte sie an den nächsten Reisenden weiter - und sie bedeuten {operatorTeam} sehr viel.',
      'Es dauert etwa dreißig Sekunden, und wir fragen danach nicht noch einmal.',
    ],
    reminderWhatsappLine:
      'Du hast WhatsApp-Updates zugestimmt, daher kann dich derselbe Bewertungslink auch dort erreichen - was immer für dich einfacher ist.',
    operatorFallback: 'die lokale Crew, die deinen Tag gefahren hat',
  },
  [Locale.fr]: {
    subject: "C'était comment, {tourName} ?",
    preview: 'Quelques mots aident le prochain voyageur à choisir sa sortie.',
    greeting: 'Bonjour {firstName},',
    greetingLine: 'Nous espérons que vous avez passé une belle journée.',
    heroSubline: 'Assurée par {operatorName} · votre sortie, {dateShort}',
    refLabel: 'Référence de réservation :',
    askBefore:
      "Si vous avez une minute, quelques mots sur le déroulement aident le prochain voyageur à savoir à quoi s'attendre, et cela compte beaucoup pour ",
    askAfter: ' et son équipe. Cela prend environ trente secondes.',
    tapAStar: 'Touchez une étoile pour commencer',
    cta: 'Notez votre sortie',
    disclosureVerified:
      'Seuls les clients ayant réservé via Island Tours peuvent laisser un avis.',
    disclosurePublishAll: 'Nous publions tous les avis, bons ou mauvais.',
    signoffThanks: 'Masha danki, merci de la part de nous tous.',
    signoffTeam: "L'équipe Island Tours · Built by Islanders.",
    footerLine:
      'Vous recevez ce message parce que vous avez participé à une sortie réservée via Island Tours. Référence de réservation {bookingRef}.',
    reminderSubject: 'Avez-vous aimé {tourName} ?',
    reminderParagraphs: [
      'Bonjour {firstName}, un dernier petit rappel de notre part - le seul, promis.',
      'Si {tourName} vous a laissé une histoire, une note en étoiles et quelques mots la transmettent au prochain voyageur - et ils comptent beaucoup pour {operatorTeam}.',
      "Cela prend environ trente secondes, et c'est la dernière fois que nous demandons.",
    ],
    reminderWhatsappLine:
      'Vous avez accepté les mises à jour WhatsApp, le même lien peut donc aussi vous parvenir là-bas - selon ce qui est le plus simple pour vous.',
    operatorFallback: "l'équipe locale qui a mené votre journée",
  },
  [Locale.es]: {
    subject: '¿Qué tal {tourName}?',
    preview: 'Unas palabras ayudan al próximo viajero a elegir su tour.',
    greeting: 'Hola {firstName}:',
    greetingLine: 'Esperamos que hayas tenido un gran día.',
    heroSubline: 'Operado por {operatorName} · tu tour, {dateShort}',
    refLabel: 'Referencia de reserva:',
    askBefore:
      'Si tienes un minuto, unas palabras sobre cómo fue ayudan al próximo viajero a saber qué esperar, y significan mucho para ',
    askAfter: ' y su equipo. Lleva unos treinta segundos.',
    tapAStar: 'Toca una estrella para empezar',
    cta: 'Valora tu tour',
    disclosureVerified:
      'Solo pueden opinar los clientes que reservaron a través de Island Tours.',
    disclosurePublishAll: 'Publicamos todas las opiniones, buenas o malas.',
    signoffThanks: 'Masha danki, gracias de parte de todos nosotros.',
    signoffTeam: 'El equipo de Island Tours · Built by Islanders.',
    footerLine:
      'Recibes este mensaje porque hiciste un tour reservado a través de Island Tours. Referencia de reserva {bookingRef}.',
    reminderSubject: '¿Disfrutaste {tourName}?',
    reminderParagraphs: [
      'Hola {firstName}, un último empujoncito de nuestra parte - el único, prometido.',
      'Si {tourName} te dejó una historia, una valoración con estrellas y unas palabras se la pasan al próximo viajero - y significan mucho para {operatorTeam}.',
      'Lleva unos treinta segundos, y es la última vez que lo pedimos.',
    ],
    reminderWhatsappLine:
      'Aceptaste recibir avisos por WhatsApp, así que el mismo enlace puede llegarte también por ahí - lo que te resulte más fácil.',
    operatorFallback: 'el equipo local que llevó tu día',
  },
  [Locale.pt]: {
    subject: 'Como foi {tourName}?',
    preview: 'Umas palavras ajudam o próximo viajante a escolher o seu tour.',
    greeting: 'Olá {firstName},',
    greetingLine: 'Esperamos que tenha tido um ótimo dia.',
    heroSubline: 'Operado por {operatorName} · o seu tour, {dateShort}',
    refLabel: 'Referência da reserva:',
    askBefore:
      'Se tiver um minuto, umas palavras sobre como correu ajudam o próximo viajante a saber o que esperar, e significam muito para ',
    askAfter: ' e para a equipa. Demora cerca de trinta segundos.',
    tapAStar: 'Toque numa estrela para começar',
    cta: 'Avalie o seu tour',
    disclosureVerified:
      'Só os clientes que reservaram através da Island Tours podem avaliar.',
    disclosurePublishAll: 'Publicamos todas as avaliações, boas ou más.',
    signoffThanks: 'Masha danki, obrigado de todos nós.',
    signoffTeam: 'A equipa Island Tours · Built by Islanders.',
    footerLine:
      'Está a receber esta mensagem porque fez um tour reservado através da Island Tours. Referência da reserva {bookingRef}.',
    reminderSubject: 'Gostou de {tourName}?',
    reminderParagraphs: [
      'Olá {firstName}, um último toque da nossa parte - o único, prometido.',
      'Se {tourName} lhe deixou uma história, uma classificação por estrelas e umas palavras passam-na ao próximo viajante - e significam muito para {operatorTeam}.',
      'Demora cerca de trinta segundos, e é a última vez que pedimos.',
    ],
    reminderWhatsappLine:
      'Aceitou receber atualizações por WhatsApp, por isso o mesmo link de avaliação também pode chegar por lá - o que for mais fácil para si.',
    operatorFallback: 'a equipa local que fez o seu dia',
  },
  [Locale.zh]: {
    subject: '{tourName} 体验如何?',
    preview: '几句评价就能帮助下一位旅行者挑选行程。',
    greeting: '{firstName},您好:',
    greetingLine: '希望您度过了愉快的一天。',
    heroSubline: '由 {operatorName} 提供 · 您的行程,{dateShort}',
    refLabel: '预订编号:',
    askBefore:
      '如果您有一分钟,几句关于当天体验的评价能让下一位旅行者知道该期待什么,这对 ',
    askAfter: ' 和团队也意义重大。大约只需三十秒。',
    tapAStar: '点击星星开始评分',
    cta: '评价您的行程',
    disclosureVerified: '只有通过 Island Tours 预订的客人才能评价。',
    disclosurePublishAll: '无论好评还是差评,我们都会发布。',
    signoffThanks: 'Masha danki,我们全体感谢您。',
    signoffTeam: 'Island Tours 团队 · Built by Islanders.',
    footerLine:
      '您收到此邮件,是因为您参加了通过 Island Tours 预订的行程。预订编号 {bookingRef}。',
    reminderSubject: '{tourName} 玩得开心吗?',
    reminderParagraphs: [
      '{firstName},这是我们最后一次小小的提醒 - 仅此一次,说到做到。',
      '如果 {tourName} 给您留下了故事,一个星级评分和几句话就能把它传递给下一位旅行者 - 这对 {operatorTeam} 也意义重大。',
      '大约三十秒,之后我们不会再打扰您。',
    ],
    reminderWhatsappLine:
      '您已同意接收 WhatsApp 消息,同样的评价链接也可能通过 WhatsApp 发送给您 - 用哪种方式都可以。',
    operatorFallback: '带您出行的当地团队',
  },
};
