import { Locale } from '@prisma/client';

/**
 * BK-3 review request + BK-3R review reminder copy, 7 locales
 * (EMAIL-IMPLEMENTATION-PLAN.md §2.9, checklist B-10/B-12).
 *
 * BK-3 English is the DECIDED copy carried over verbatim from
 * `MailService.sendReviewRequestEmail` (autonomy cue, outward favor, ease
 * last). BK-3R English is the WP-B DRAFT awaiting founder sign-off
 * (decision D1) - distinct from BK-3, deliberately lighter, and explicit
 * that it is the one and only reminder. The other six locales are
 * machine-first translations of both.
 *
 * `{slots}`: firstName, tourName, operatorTeam (the operator's company name,
 * falling back to the locale's `operatorFallback` when none is on file).
 */
export interface ReviewRequestCopy {
  /** "How was {tourName}?" */
  subject: string;
  /** First-touch paragraphs, in order. */
  paragraphs: string[];
  /** "Did you enjoy {tourName}?" */
  reminderSubject: string;
  /** Reminder paragraphs - the BK-3R draft. */
  reminderParagraphs: string[];
  /**
   * Appended to the reminder ONLY when `reviewWhatsappOptIn` is set. The
   * WhatsApp send channel itself is not built - this only sets expectation.
   */
  reminderWhatsappLine: string;
  /** "Rate your tour" - the CTA on both touches. */
  cta: string;
  /** Plain-text sign-off, first touch. */
  textSignoff: string;
  /** Plain-text sign-off, reminder. */
  reminderTextSignoff: string;
  /** Stand-in for {operatorTeam} when no operator name is on file. */
  operatorFallback: string;
}

export const REVIEW_REQUEST_COPY: Record<Locale, ReviewRequestCopy> = {
  [Locale.en]: {
    subject: 'How was {tourName}?',
    paragraphs: [
      'Hi {firstName},',
      'We hope {tourName} was everything you came to the islands for.',
      'Travellers trust other travellers, so a quick word about your day helps the next guest book with confidence, and it means a lot to the local team who ran your tour.',
      'It takes about thirty seconds.',
    ],
    reminderSubject: 'Did you enjoy {tourName}?',
    reminderParagraphs: [
      'Hi {firstName}, one small nudge from us - the only one, promise.',
      'If {tourName} left you with a story, a star rating and a few words pass it on to the next traveller - and they mean a lot to {operatorTeam}.',
      'It takes about thirty seconds, and this is the last time we ask.',
    ],
    reminderWhatsappLine:
      'You opted in to WhatsApp updates, so the same review link may also reach you there - whichever is easier for you.',
    cta: 'Rate your tour',
    textSignoff: 'Thank you for spending your day with us. Built by Islanders.',
    reminderTextSignoff: 'Masha danki - thank you from all of us.',
    operatorFallback: 'the local crew who ran your day',
  },
  [Locale.nl]: {
    subject: 'Hoe was {tourName}?',
    paragraphs: [
      'Hoi {firstName},',
      'We hopen dat {tourName} alles was waarvoor je naar de eilanden kwam.',
      'Reizigers vertrouwen andere reizigers: een paar woorden over je dag helpen de volgende gast met vertrouwen te boeken, en het betekent veel voor het lokale team dat je tour draaide.',
      'Het kost ongeveer dertig seconden.',
    ],
    reminderSubject: 'Heb je genoten van {tourName}?',
    reminderParagraphs: [
      'Hoi {firstName}, nog één klein duwtje van ons - het enige, beloofd.',
      'Als {tourName} je een verhaal heeft opgeleverd, geven een sterrenscore en een paar woorden dat door aan de volgende reiziger - en ze betekenen veel voor {operatorTeam}.',
      'Het kost ongeveer dertig seconden, en dit is de laatste keer dat we het vragen.',
    ],
    reminderWhatsappLine:
      'Je hebt je aangemeld voor WhatsApp-updates, dus dezelfde reviewlink kan je daar ook bereiken - wat voor jou het makkelijkst is.',
    cta: 'Beoordeel je tour',
    textSignoff:
      'Bedankt dat je je dag met ons doorbracht. Built by Islanders.',
    reminderTextSignoff: 'Masha danki - bedankt van ons allemaal.',
    operatorFallback: 'de lokale crew die je dag draaide',
  },
  [Locale.de]: {
    subject: 'Wie war {tourName}?',
    paragraphs: [
      'Hallo {firstName},',
      'wir hoffen, {tourName} war alles, wofür du auf die Inseln gekommen bist.',
      'Reisende vertrauen anderen Reisenden: ein paar Worte zu deinem Tag helfen dem nächsten Gast, mit gutem Gefühl zu buchen - und sie bedeuten dem lokalen Team, das deine Tour gefahren hat, sehr viel.',
      'Es dauert etwa dreißig Sekunden.',
    ],
    reminderSubject: 'Hat dir {tourName} gefallen?',
    reminderParagraphs: [
      'Hallo {firstName}, ein kleiner Stups von uns - der einzige, versprochen.',
      'Wenn dir {tourName} eine Geschichte hinterlassen hat, geben eine Sternebewertung und ein paar Worte sie an den nächsten Reisenden weiter - und sie bedeuten {operatorTeam} sehr viel.',
      'Es dauert etwa dreißig Sekunden, und wir fragen danach nicht noch einmal.',
    ],
    reminderWhatsappLine:
      'Du hast WhatsApp-Updates zugestimmt, daher kann dich derselbe Bewertungslink auch dort erreichen - was immer für dich einfacher ist.',
    cta: 'Tour bewerten',
    textSignoff:
      'Danke, dass du deinen Tag mit uns verbracht hast. Built by Islanders.',
    reminderTextSignoff: 'Masha danki - danke von uns allen.',
    operatorFallback: 'die lokale Crew, die deinen Tag gefahren hat',
  },
  [Locale.fr]: {
    subject: "C'était comment, {tourName} ?",
    paragraphs: [
      'Bonjour {firstName},',
      'Nous espérons que {tourName} a été tout ce que vous étiez venu chercher sur les îles.',
      "Les voyageurs font confiance aux voyageurs : quelques mots sur votre journée aident le prochain visiteur à réserver en confiance, et ils comptent beaucoup pour l'équipe locale qui a mené votre sortie.",
      'Cela prend environ trente secondes.',
    ],
    reminderSubject: 'Avez-vous aimé {tourName} ?',
    reminderParagraphs: [
      'Bonjour {firstName}, un dernier petit rappel de notre part - le seul, promis.',
      'Si {tourName} vous a laissé une histoire, une note en étoiles et quelques mots la transmettent au prochain voyageur - et ils comptent beaucoup pour {operatorTeam}.',
      "Cela prend environ trente secondes, et c'est la dernière fois que nous demandons.",
    ],
    reminderWhatsappLine:
      'Vous avez accepté les mises à jour WhatsApp, le même lien peut donc aussi vous parvenir là-bas - selon ce qui est le plus simple pour vous.',
    cta: 'Notez votre sortie',
    textSignoff:
      "Merci d'avoir passé votre journée avec nous. Built by Islanders.",
    reminderTextSignoff: 'Masha danki - merci de la part de nous tous.',
    operatorFallback: "l'équipe locale qui a mené votre journée",
  },
  [Locale.es]: {
    subject: '¿Qué tal {tourName}?',
    paragraphs: [
      'Hola {firstName}:',
      'Esperamos que {tourName} fuera todo lo que viniste a buscar a las islas.',
      'Los viajeros confían en otros viajeros: unas palabras sobre tu día ayudan al próximo visitante a reservar con confianza, y significan mucho para el equipo local que llevó tu tour.',
      'Lleva unos treinta segundos.',
    ],
    reminderSubject: '¿Disfrutaste {tourName}?',
    reminderParagraphs: [
      'Hola {firstName}, un último empujoncito de nuestra parte - el único, prometido.',
      'Si {tourName} te dejó una historia, una valoración con estrellas y unas palabras se la pasan al próximo viajero - y significan mucho para {operatorTeam}.',
      'Lleva unos treinta segundos, y es la última vez que lo pedimos.',
    ],
    reminderWhatsappLine:
      'Aceptaste recibir avisos por WhatsApp, así que el mismo enlace puede llegarte también por ahí - lo que te resulte más fácil.',
    cta: 'Valora tu tour',
    textSignoff: 'Gracias por pasar tu día con nosotros. Built by Islanders.',
    reminderTextSignoff: 'Masha danki - gracias de parte de todos nosotros.',
    operatorFallback: 'el equipo local que llevó tu día',
  },
  [Locale.pt]: {
    subject: 'Como foi {tourName}?',
    paragraphs: [
      'Olá {firstName},',
      'Esperamos que {tourName} tenha sido tudo o que veio procurar às ilhas.',
      'Os viajantes confiam noutros viajantes: umas palavras sobre o seu dia ajudam o próximo visitante a reservar com confiança, e significam muito para a equipa local que fez o seu tour.',
      'Demora cerca de trinta segundos.',
    ],
    reminderSubject: 'Gostou de {tourName}?',
    reminderParagraphs: [
      'Olá {firstName}, um último toque da nossa parte - o único, prometido.',
      'Se {tourName} lhe deixou uma história, uma classificação por estrelas e umas palavras passam-na ao próximo viajante - e significam muito para {operatorTeam}.',
      'Demora cerca de trinta segundos, e é a última vez que pedimos.',
    ],
    reminderWhatsappLine:
      'Aceitou receber atualizações por WhatsApp, por isso o mesmo link de avaliação também pode chegar por lá - o que for mais fácil para si.',
    cta: 'Avalie o seu tour',
    textSignoff: 'Obrigado por passar o seu dia connosco. Built by Islanders.',
    reminderTextSignoff: 'Masha danki - obrigado de todos nós.',
    operatorFallback: 'a equipa local que fez o seu dia',
  },
  [Locale.zh]: {
    subject: '{tourName} 体验如何?',
    paragraphs: [
      '{firstName},您好:',
      '希望 {tourName} 不负您远道而来。',
      '旅行者最信任旅行者:您对这一天的几句评价,能帮助下一位客人放心预订,也对带您出行的当地团队意义重大。',
      '大约只需三十秒。',
    ],
    reminderSubject: '{tourName} 玩得开心吗?',
    reminderParagraphs: [
      '{firstName},这是我们最后一次小小的提醒 - 仅此一次,说到做到。',
      '如果 {tourName} 给您留下了故事,一个星级评分和几句话就能把它传递给下一位旅行者 - 这对 {operatorTeam} 也意义重大。',
      '大约三十秒,之后我们不会再打扰您。',
    ],
    reminderWhatsappLine:
      '您已同意接收 WhatsApp 消息,同样的评价链接也可能通过 WhatsApp 发送给您 - 用哪种方式都可以。',
    cta: '评价您的行程',
    textSignoff: '感谢您与我们共度这一天。Built by Islanders.',
    reminderTextSignoff: 'Masha danki - 我们全体感谢您。',
    operatorFallback: '带您出行的当地团队',
  },
};
