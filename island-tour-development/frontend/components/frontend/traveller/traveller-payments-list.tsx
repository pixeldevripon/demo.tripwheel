import Link from 'next/link';

import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { TravellerPayment } from '@/lib/api/public/traveller';

import { paymentTone, TravellerChip } from './traveller-chip';
import { formatDay, lookupLabel, money } from './traveller-format';

/**
 * Payment history: every charge and refund on the traveller's bookings, as
 * cards matching the booking list rather than a dashboard table.
 *
 * A refund is shown as a negative amount in green - money coming back, which a
 * bare positive figure in a list of charges would misread as another payment.
 */
export function TravellerPaymentsList({
    payments,
    dict,
    locale,
}: {
    payments: TravellerPayment[];
    dict: Dictionary['traveller'];
    locale: Locale;
}) {
    return (
        <ul className='m-0 flex list-none flex-col gap-3 p-0'>
            {payments.map(payment => {
                const isRefund = payment.kind === 'REFUND';
                const amount = money(payment.amount, payment.currency, locale);
                const kindLabel = dict.paymentKind[payment.kind] ?? payment.kind;
                const statusLabel = lookupLabel(
                    dict.paymentStatus,
                    payment.status
                );
                const manageHref = payment.destinationSlug
                    ? `/${payment.destinationSlug}/thank-you/${payment.bookingPublicRef}`
                    : null;

                return (
                    <li
                        key={payment.id}
                        className='rounded-[16px] border border-it-heading/10 bg-it-white p-5 sm:px-6'>
                        <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-3'>
                            <div className='min-w-0 flex-1'>
                                <div className='mb-1.5'>
                                    <TravellerChip
                                        label={statusLabel}
                                        tone={paymentTone(payment.status)}
                                    />
                                </div>
                                <strong className='block font-medium text-[17px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                    {kindLabel}
                                    {payment.tourName && (
                                        <span className='font-normal text-it-text-muted'>
                                            {'  ·  '}
                                            {payment.tourName}
                                        </span>
                                    )}
                                </strong>
                                <span className='mt-1 block text-[14px] leading-[1.6] text-it-text-muted'>
                                    {formatDay(payment.createdAt, locale)}
                                    {'  ·  '}
                                    {dict.travelDate.replace(
                                        '{date}',
                                        formatDay(payment.bookingLocalDate, locale)
                                    )}
                                </span>
                                <span className='mt-1 block font-mono text-[13px] text-it-text-muted'>
                                    {manageHref ? (
                                        <Link
                                            href={manageHref}
                                            className='no-underline transition-colors hover:text-it-primary'>
                                            {payment.bookingDisplayRef}
                                        </Link>
                                    ) : (
                                        payment.bookingDisplayRef
                                    )}
                                </span>
                            </div>
                            <div className='shrink-0 text-right'>
                                <strong
                                    className={`block font-medium text-[20px] leading-[1.3] tracking-[-0.012em] ${
                                        isRefund ? 'text-it-green' : 'text-it-heading'
                                    }`}>
                                    {isRefund ? `- ${amount}` : amount}
                                </strong>
                                {payment.methodType && (
                                    <span className='mt-0.5 block text-[13px] text-it-text-muted capitalize'>
                                        {payment.methodType}
                                    </span>
                                )}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
