import { readFileSync } from 'fs';
import { join } from 'path';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
} from './email-template.renderer';

describe('renderEmailTemplate', () => {
  describe('token substitution', () => {
    it('substitutes known tokens', () => {
      expect(
        renderEmailTemplate('Hi {firstName}, ref {bookingRef}.', {
          firstName: 'Ada',
          bookingRef: 'IT-2026-1234',
        }),
      ).toBe('Hi Ada, ref IT-2026-1234.');
    });

    it('renders null/undefined as empty', () => {
      expect(renderEmailTemplate('[{a}][{b}]', { a: null, b: undefined })).toBe(
        '[][]',
      );
    });

    it('leaves an UNKNOWN token literal so the bug is loud, not silent', () => {
      expect(renderEmailTemplate('Bring {whatToBring}', {})).toBe(
        'Bring {whatToBring}',
      );
      expect(findUnresolvedTokens('Bring {whatToBring}', {})).toEqual([
        'whatToBring',
      ]);
    });

    it('escapes HTML in values (operator names are user input)', () => {
      expect(
        renderEmailTemplate('{operatorName}', {
          operatorName: '<script>alert("x")</script> & Co',
        }),
      ).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co');
    });

    it('does not mangle CSS blocks (they are braces too)', () => {
      const css = '@media (max-width: 620px) { .shell { width: 100% } }';
      expect(renderEmailTemplate(css, { firstName: 'Ada' })).toBe(css);
    });
  });

  describe('conditionals', () => {
    it('keeps the body when truthy and drops it when falsy', () => {
      const t = '[IF hasPickup]Pickup: {pickupLocation}.[/IF]';
      expect(
        renderEmailTemplate(t, { hasPickup: true, pickupLocation: 'Marriott' }),
      ).toBe('Pickup: Marriott.');
      expect(
        renderEmailTemplate(t, {
          hasPickup: false,
          pickupLocation: 'Marriott',
        }),
      ).toBe('');
    });

    it('treats empty string, null and 0 as falsy', () => {
      const t = '[IF duration]D:{duration}[/IF]';
      expect(renderEmailTemplate(t, { duration: '' })).toBe('');
      expect(renderEmailTemplate(t, { duration: null })).toBe('');
      expect(renderEmailTemplate(t, { duration: 0 })).toBe('');
      expect(renderEmailTemplate(t, { duration: '4h' })).toBe('D:4h');
    });

    it('honours [ELSE]', () => {
      const t =
        '[IF hasPickup]Pickup: {pickupLocation}[ELSE]Meet: {meetingPoint}[/IF]';
      expect(
        renderEmailTemplate(t, {
          hasPickup: true,
          pickupLocation: 'Marriott',
          meetingPoint: 'Pier',
        }),
      ).toBe('Pickup: Marriott');
      expect(
        renderEmailTemplate(t, {
          hasPickup: false,
          pickupLocation: 'Marriott',
          meetingPoint: 'Pier',
        }),
      ).toBe('Meet: Pier');
    });

    it('matches equality', () => {
      const t = '[IF paymentModel = on_arrival]ARRIVE[/IF]';
      expect(renderEmailTemplate(t, { paymentModel: 'on_arrival' })).toBe(
        'ARRIVE',
      );
      expect(renderEmailTemplate(t, { paymentModel: 'paid_in_full' })).toBe('');
    });

    it('matches `field = a OR b` (field named once)', () => {
      const t = '[IF paymentModel = operator_link OR on_arrival]DEPOSIT[/IF]';
      expect(renderEmailTemplate(t, { paymentModel: 'operator_link' })).toBe(
        'DEPOSIT',
      );
      expect(renderEmailTemplate(t, { paymentModel: 'on_arrival' })).toBe(
        'DEPOSIT',
      );
      expect(renderEmailTemplate(t, { paymentModel: 'paid_in_full' })).toBe('');
    });

    it('matches AND (both sides must hold)', () => {
      const t =
        '[IF paymentModel = on_arrival AND onArrivalPayment = card_or_cash]CARD_OR_CASH[/IF]';
      expect(
        renderEmailTemplate(t, {
          paymentModel: 'on_arrival',
          onArrivalPayment: 'card_or_cash',
        }),
      ).toBe('CARD_OR_CASH');
      expect(
        renderEmailTemplate(t, {
          paymentModel: 'on_arrival',
          onArrivalPayment: 'cash_only',
        }),
      ).toBe('');
      expect(
        renderEmailTemplate(t, {
          paymentModel: 'paid_in_full',
          onArrivalPayment: 'card_or_cash',
        }),
      ).toBe('');
    });

    it('resolves NESTED blocks and picks the right [ELSE]', () => {
      const t = '[IF a]A([IF b]B[ELSE]notB[/IF])[ELSE]notA[/IF]';
      expect(renderEmailTemplate(t, { a: true, b: true })).toBe('A(B)');
      expect(renderEmailTemplate(t, { a: true, b: false })).toBe('A(notB)');
      expect(renderEmailTemplate(t, { a: false, b: true })).toBe('notA');
    });

    it('never substitutes tokens inside a dropped branch', () => {
      expect(
        renderEmailTemplate('[IF show]{secret}[/IF]', {
          show: false,
          secret: 'LEAK',
        }),
      ).not.toContain('LEAK');
    });

    it('throws on an unclosed block rather than emitting half an email', () => {
      expect(() => renderEmailTemplate('[IF a]dangling', { a: true })).toThrow(
        /Unclosed \[IF a\]/,
      );
    });
  });

  describe('the locked booking-confirmation template', () => {
    const template = readFileSync(
      join(__dirname, 'booking-confirmation-email.template.html'),
      'utf8',
    );

    // Guards the shipped artifact: a designer edit that unbalances a block should
    // fail here, not in a traveller's inbox.
    it('is structurally valid (every [IF closed)', () => {
      expect(() =>
        renderEmailTemplate(template, { paymentModel: 'operator_link' }),
      ).not.toThrow();
    });

    it('uses only the supported language (no [ELSEIF - the wireframe has none)', () => {
      expect(template).not.toContain('[ELSEIF');
    });

    const money = (paymentModel: string) =>
      renderEmailTemplate(template, {
        paymentModel,
        depositPct: '20',
        depositAmount: '$40.00',
        balanceAmount: '$160.00',
        totalAmount: '$200.00',
      });

    // The money rows per model, exactly as the wireframe spells them out.
    it('operator_link: deposit + "Balance due" + total', () => {
      const html = money('operator_link');
      expect(html).toContain('Deposit paid today (20%)');
      expect(html).toContain('Balance due');
      expect(html).not.toContain('Balance due on arrival');
      expect(html).toContain('Total');
    });

    it('on_arrival: deposit + "Balance due on arrival" + total', () => {
      const html = money('on_arrival');
      expect(html).toContain('Deposit paid today (20%)');
      expect(html).toContain('Balance due on arrival');
      expect(html).toContain('Total');
    });

    it('paid_in_full: "Paid in full" only - no deposit/balance row OR amount', () => {
      const html = money('paid_in_full');
      expect(html).toContain('Paid in full');
      expect(html).not.toContain('Deposit paid today');
      expect(html).not.toContain('Balance due');
      // The row must vanish entirely - a bare amount with no label is the bug
      // the original template shipped (it wrapped only the label, not the <td>).
      expect(html).not.toContain('$40.00');
      expect(html).not.toContain('$160.00');
      expect(html).toContain('$200.00');
    });

    it('operator_full: "Total" only - nothing was paid, so no deposit/balance', () => {
      const html = money('operator_full');
      expect(html).toContain('Total');
      expect(html).not.toContain('Deposit paid today');
      expect(html).not.toContain('Balance due');
      expect(html).not.toContain('$40.00');
      expect(html).not.toContain('$160.00');
    });
  });
});
