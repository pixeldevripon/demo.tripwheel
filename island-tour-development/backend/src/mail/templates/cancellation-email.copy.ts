import { Locale } from '@prisma/client';

/**
 * CX-1 cancellation-confirmed copy (traveller side), 7 locales
 * (EMAIL-IMPLEMENTATION-PLAN.md §2.9, checklist B-23…B-25).
 *
 * English is canonical and follows the LOCKED master 6.4 wording as pinned by
 * the funnel wireframe: `paid_in_full` opens with "…is on its way back from
 * us"; `operator_full` carries NO refund-from-us line ("Nothing was paid to
 * Island Tours…"); deposit models get the deposit-back + operator-balance
 * split. The refund paragraph is a MATRIX of `paymentModel` × the existing
 * `CancellationRefund` verdict (FULL / PARTIAL / NONE) - the verdict overlay
 * is composed with, never replaced by, the payment-model branch (B-24).
 *
 * The OPERATOR notice deliberately stays English (dashboard language) and
 * keeps its strings at the call site.
 */
export interface CancellationEmailCopy {
  /** "Your booking is cancelled - {bookingRef}" */
  subject: string;
  /** "Your booking is cancelled." - the headline. */
  title: string;
  /** "We have processed your request and cancelled {bookingRef} for {tourName}…" */
  processed: string;
  /**
   * FULL refund, `operator_link`: deposit back from us + the operator refunds
   * an already-paid balance ({depositPct}).
   */
  refundDepositSplit: string;
  /** FULL refund, `paid_in_full` ({totalAmount}). */
  refundPaidInFull: string;
  /** `operator_full`, any verdict: no money ever reached Island Tours ({operatorName}). */
  operatorFullLine: string;
  /** PARTIAL verdict (non-operator_full models). */
  partial: string;
  /** NONE verdict (non-operator_full models). */
  noRefund: string;
  /** The closing paragraph. */
  closing: string;
  /** "View your booking" */
  cta: string;
  /** Stand-in for {operatorName} when none is on file. */
  operatorFallback: string;
}

export const CANCELLATION_EMAIL_COPY: Record<Locale, CancellationEmailCopy> = {
  [Locale.en]: {
    subject: 'Your booking is cancelled',
    title: 'Your booking is cancelled.',
    processed:
      'We have processed your request and cancelled {bookingRef} for {tourName}. Your seats have been released.',
    refundDepositSplit:
      "Your {depositPct}% deposit is on its way back from us, within 3 to 5 business days, to your original payment method. If you've already paid the balance, the tour operator refunds that part. Don't see your balance refund within 10 days? Message us and we'll chase it.",
    refundPaidInFull:
      'Your payment of {totalAmount} is on its way back from us, within 3 to 5 business days, to your original payment method.',
    operatorFullLine:
      'Nothing was paid to Island Tours for this booking. Already paid the operator? Then {operatorName} refunds you directly.',
    partial:
      'A partial refund applies under the cancellation terms for this trip. We will email you the exact amount as it is processed.',
    noRefund:
      'This cancellation falls outside the free-cancellation window for this trip, so no refund is due. If you think something went wrong, just reply to this email.',
    closing:
      'Nothing further is needed from you. Booked by mistake, or want to rebook for another date? Just reply to this email.',
    cta: 'View your booking',
    operatorFallback: 'the operator',
  },
  [Locale.nl]: {
    subject: 'Je boeking is geannuleerd',
    title: 'Je boeking is geannuleerd.',
    processed:
      'We hebben je verzoek verwerkt en {bookingRef} voor {tourName} geannuleerd. Je plaatsen zijn vrijgegeven.',
    refundDepositSplit:
      'Je aanbetaling van {depositPct}% is onderweg terug van ons, binnen 3 tot 5 werkdagen, naar je oorspronkelijke betaalmethode. Heb je het restbedrag al betaald? Dan betaalt de touroperator dat deel terug. Zie je die terugbetaling niet binnen 10 dagen? Stuur ons een bericht, dan gaan we erachteraan.',
    refundPaidInFull:
      'Je betaling van {totalAmount} is onderweg terug van ons, binnen 3 tot 5 werkdagen, naar je oorspronkelijke betaalmethode.',
    operatorFullLine:
      'Er is voor deze boeking niets aan Island Tours betaald. Al aan de operator betaald? Dan betaalt {operatorName} je rechtstreeks terug.',
    partial:
      'Volgens de annuleringsvoorwaarden van deze trip geldt een gedeeltelijke terugbetaling. We mailen je het exacte bedrag zodra het verwerkt is.',
    noRefund:
      'Deze annulering valt buiten de gratis-annuleringstermijn van deze trip, dus er is geen terugbetaling verschuldigd. Denk je dat er iets misging? Beantwoord dan gewoon deze e-mail.',
    closing:
      'Je hoeft verder niets te doen. Per ongeluk geboekt, of wil je omboeken naar een andere datum? Beantwoord dan gewoon deze e-mail.',
    cta: 'Bekijk je boeking',
    operatorFallback: 'de operator',
  },
  [Locale.de]: {
    subject: 'Deine Buchung ist storniert',
    title: 'Deine Buchung ist storniert.',
    processed:
      'Wir haben deine Anfrage bearbeitet und {bookingRef} für {tourName} storniert. Deine Plätze wurden freigegeben.',
    refundDepositSplit:
      'Deine Anzahlung von {depositPct}% ist von uns aus auf dem Rückweg, innerhalb von 3 bis 5 Werktagen, auf deine ursprüngliche Zahlungsmethode. Hast du den Restbetrag schon bezahlt? Den erstattet dir der Veranstalter. Siehst du diese Erstattung nicht innerhalb von 10 Tagen? Schreib uns, wir haken nach.',
    refundPaidInFull:
      'Deine Zahlung von {totalAmount} ist von uns aus auf dem Rückweg, innerhalb von 3 bis 5 Werktagen, auf deine ursprüngliche Zahlungsmethode.',
    operatorFullLine:
      'Für diese Buchung wurde nichts an Island Tours gezahlt. Schon an den Veranstalter gezahlt? Dann erstattet dir {operatorName} direkt.',
    partial:
      'Nach den Stornobedingungen dieser Tour gilt eine Teilerstattung. Den genauen Betrag mailen wir dir, sobald er verarbeitet ist.',
    noRefund:
      'Diese Stornierung liegt außerhalb des kostenlosen Stornofensters dieser Tour, daher ist keine Erstattung fällig. Glaubst du, da ist etwas schiefgelaufen? Antworte einfach auf diese E-Mail.',
    closing:
      'Du musst nichts weiter tun. Versehentlich gebucht, oder möchtest du auf ein anderes Datum umbuchen? Antworte einfach auf diese E-Mail.',
    cta: 'Buchung ansehen',
    operatorFallback: 'der Veranstalter',
  },
  [Locale.fr]: {
    subject: 'Votre réservation est annulée',
    title: 'Votre réservation est annulée.',
    processed:
      'Nous avons traité votre demande et annulé {bookingRef} pour {tourName}. Vos places ont été libérées.',
    refundDepositSplit:
      "Votre acompte de {depositPct}% est en route depuis chez nous, sous 3 à 5 jours ouvrés, vers votre moyen de paiement d'origine. Vous avez déjà réglé le solde ? L'opérateur vous rembourse cette partie directement. Pas de remboursement du solde sous 10 jours ? Écrivez-nous et nous le réclamerons.",
    refundPaidInFull:
      "Votre paiement de {totalAmount} est en route depuis chez nous, sous 3 à 5 jours ouvrés, vers votre moyen de paiement d'origine.",
    operatorFullLine:
      "Rien n'a été payé à Island Tours pour cette réservation. Déjà payé l'opérateur ? Alors {operatorName} vous rembourse directement.",
    partial:
      "Un remboursement partiel s'applique selon les conditions d'annulation de cette sortie. Nous vous enverrons le montant exact dès qu'il sera traité.",
    noRefund:
      "Cette annulation est hors de la fenêtre d'annulation gratuite de cette sortie, aucun remboursement n'est donc dû. Vous pensez qu'il y a une erreur ? Répondez simplement à cet e-mail.",
    closing:
      "Rien d'autre n'est attendu de votre part. Réservé par erreur, ou envie de re-réserver à une autre date ? Répondez simplement à cet e-mail.",
    cta: 'Voir votre réservation',
    operatorFallback: "l'opérateur",
  },
  [Locale.es]: {
    subject: 'Tu reserva está cancelada',
    title: 'Tu reserva está cancelada.',
    processed:
      'Hemos procesado tu solicitud y cancelado {bookingRef} para {tourName}. Tus plazas han quedado liberadas.',
    refundDepositSplit:
      'Tu depósito del {depositPct}% está en camino de vuelta desde nosotros, en 3 a 5 días laborables, a tu método de pago original. ¿Ya pagaste el resto? Esa parte te la reembolsa el operador del tour. ¿No ves ese reembolso en 10 días? Escríbenos y lo reclamamos.',
    refundPaidInFull:
      'Tu pago de {totalAmount} está en camino de vuelta desde nosotros, en 3 a 5 días laborables, a tu método de pago original.',
    operatorFullLine:
      'Por esta reserva no se pagó nada a Island Tours. ¿Ya pagaste al operador? Entonces {operatorName} te reembolsa directamente.',
    partial:
      'Según las condiciones de cancelación de este viaje corresponde un reembolso parcial. Te enviaremos el importe exacto en cuanto se procese.',
    noRefund:
      'Esta cancelación queda fuera de la ventana de cancelación gratuita de este viaje, así que no corresponde reembolso. ¿Crees que algo salió mal? Responde a este correo.',
    closing:
      '¿Reservaste por error o quieres volver a reservar para otra fecha? No necesitas hacer nada más: simplemente responde a este correo.',
    cta: 'Ver tu reserva',
    operatorFallback: 'el operador',
  },
  [Locale.pt]: {
    subject: 'A sua reserva foi cancelada',
    title: 'A sua reserva foi cancelada.',
    processed:
      'Processámos o seu pedido e cancelámos {bookingRef} para {tourName}. Os seus lugares foram libertados.',
    refundDepositSplit:
      'O seu depósito de {depositPct}% está a caminho de volta, enviado por nós em 3 a 5 dias úteis para o seu método de pagamento original. Já pagou o restante? Essa parte é reembolsada pelo operador do tour. Não vê esse reembolso em 10 dias? Escreva-nos e nós tratamos disso.',
    refundPaidInFull:
      'O seu pagamento de {totalAmount} está a caminho de volta, enviado por nós em 3 a 5 dias úteis para o seu método de pagamento original.',
    operatorFullLine:
      'Nada foi pago à Island Tours por esta reserva. Já pagou ao operador? Então {operatorName} reembolsa-o diretamente.',
    partial:
      'Segundo as condições de cancelamento desta viagem aplica-se um reembolso parcial. Enviaremos o valor exato por e-mail assim que for processado.',
    noRefund:
      'Este cancelamento fica fora da janela de cancelamento gratuito desta viagem, pelo que não há reembolso devido. Acha que algo correu mal? Basta responder a este e-mail.',
    closing:
      'Não precisa de fazer mais nada. Reservou por engano, ou quer voltar a reservar para outra data? Basta responder a este e-mail.',
    cta: 'Ver a sua reserva',
    operatorFallback: 'o operador',
  },
  [Locale.zh]: {
    subject: '您的预订已取消',
    title: '您的预订已取消。',
    processed:
      '我们已处理您的请求并取消了 {tourName} 的预订 {bookingRef}。您的名额已释放。',
    refundDepositSplit:
      '您 {depositPct}% 的订金正由我们退回,3 至 5 个工作日内原路退回到您的付款方式。已经支付了余款?那部分由旅行社直接退还给您。10 天内没有收到余款退款?请联系我们,我们来跟进。',
    refundPaidInFull:
      '您支付的 {totalAmount} 正由我们退回,3 至 5 个工作日内原路退回到您的付款方式。',
    operatorFullLine:
      '此预订没有向 Island Tours 支付任何款项。已经付款给运营方?那么 {operatorName} 会直接退款给您。',
    partial:
      '根据本行程的取消条款,适用部分退款。确切金额处理后我们会通过邮件告知您。',
    noRefund:
      '此次取消超出了本行程的免费取消期限,因此不产生退款。如果您认为有误,请直接回复此邮件。',
    closing: '您无需再做任何事情。误订了,或想改订其他日期?直接回复此邮件即可。',
    cta: '查看您的预订',
    operatorFallback: '运营方',
  },
};
