'use client';

import { formatCheckoutMoney } from '@/lib/checkout/checkout';
import type { Currency, Locale } from '@/lib/constants/locales';
import Image from 'next/image';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Live checkout state for the SERVER-rendered summary card.
 *
 * The summary is streamed into the client shell as a node, but pickup (and with
 * it the authoritative totals - a priced PAID_ADDON zone changes the money) is
 * chosen in the client form, so the summary can never see the selection through
 * props. This context bridges the two: `CheckoutClient` owns the selected pickup
 * label and the re-quoted totals and provides them; the summary's pickup row and
 * money rows are the client leaves that consume them, falling back to the
 * server-rendered values until the traveller changes something.
 */
/** One rendered breakdown row ("Adult x 2 x $139" style, like the widget). */
export interface CheckoutBreakdownRow {
    id: string;
    label: string;
    amount: number;
}

export interface CheckoutLiveTotals {
    total: number;
    payToday: number;
    balanceLater: number;
    /** Re-quoted line breakdown (participants + add-ons + pickup); absent on
     *  the server fallback, which passes its own rows separately. */
    lines?: CheckoutBreakdownRow[];
}

interface CheckoutLiveState {
    pickupLabel: string | null;
    /** Re-quoted totals after a pickup change; null = server totals still hold. */
    totals: CheckoutLiveTotals | null;
}

const CheckoutLiveContext = createContext<CheckoutLiveState>({
    pickupLabel: null,
    totals: null,
});

export function CheckoutLiveProvider({
    value,
    children,
}: {
    value: CheckoutLiveState;
    children: ReactNode;
}) {
    return (
        <CheckoutLiveContext.Provider value={value}>
            {children}
        </CheckoutLiveContext.Provider>
    );
}

/**
 * The summary card's pickup row - markup identical to the server `SummaryRow`
 * (icon 24, gap 10), just with a live label.
 */
export function CheckoutSummaryPickupRow({ fallback }: { fallback: string }) {
    const { pickupLabel } = useContext(CheckoutLiveContext);
    return (
        <div className='flex items-center justify-between gap-2.5'>
            <span className='flex items-center gap-2.5 text-[13.5px] leading-[1.6] text-it-ink'>
                <Image
                    src='/icons/checkout/location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0'
                />
                {pickupLabel ?? fallback}
            </span>
        </div>
    );
}

/**
 * A live money amount inside the summary (the party row's total value): shows
 * the re-quoted figure once a priced pickup changes the money, else the
 * server-rendered fallback.
 */
export function CheckoutLiveAmount({
    kind,
    fallback,
    currency,
    locale,
}: {
    kind: 'total' | 'payToday' | 'balanceLater';
    fallback: number;
    currency: Currency;
    locale: Locale;
}) {
    const { totals } = useContext(CheckoutLiveContext);
    return (
        <>
            {formatCheckoutMoney(
                totals?.[kind] ?? fallback,
                currency,
                locale
            )}
        </>
    );
}

/**
 * The summary's Total / Pay today / Balance later block, re-rendered live from
 * the re-quoted totals (zero-amount rows stay hidden, master §5.8 / log 82).
 */
export function CheckoutSummaryTotals({
    fallback,
    fallbackLines,
    labels,
    currency,
    locale,
}: {
    fallback: CheckoutLiveTotals;
    /** Server-derived breakdown for the URL selection (pre-pickup). */
    fallbackLines?: CheckoutBreakdownRow[];
    labels: { total: string; payToday: string; balanceLater: string };
    currency: Currency;
    locale: Locale;
}) {
    const { totals } = useContext(CheckoutLiveContext);
    const t = totals ?? fallback;
    const lines = totals?.lines ?? fallbackLines ?? [];
    const money = (n: number) => formatCheckoutMoney(n, currency, locale);
    const row =
        'flex items-center justify-between gap-1 text-[14px] leading-[1.6] text-it-ink';
    const amt = 'font-bold tabular-nums';
    return (
        <>
            {/* Per-line breakdown (participants, extras, pickup) - the same
                item math the widget shows under "Show details". */}
            {lines.length > 0 && (
                <>
                    {lines.map(line => (
                        <div key={line.id} className={row}>
                            <span>{line.label}</span>
                            <span className={amt}>{money(line.amount)}</span>
                        </div>
                    ))}
                    <div className='h-px w-full bg-it-divider' />
                </>
            )}
            <div className={`${row} text-[15px] font-bold`}>
                <span>{labels.total}</span>
                <span className='tabular-nums'>{money(t.total)}</span>
            </div>
            {t.payToday > 0 && (
                <div className={row}>
                    <span>{labels.payToday}</span>
                    <span className={`${amt} text-it-primary-hover`}>
                        {money(t.payToday)}
                    </span>
                </div>
            )}
            {t.balanceLater > 0 && (
                <div className={row}>
                    <span>{labels.balanceLater}</span>
                    <span className={amt}>{money(t.balanceLater)}</span>
                </div>
            )}
        </>
    );
}

