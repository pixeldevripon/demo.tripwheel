'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { TravellerBooking } from '@/lib/api/public/traveller';
import {
    changeDateClient,
    getDateChangeOptionsClient,
    type DateChangeOption,
} from '@/lib/api/traveller-login';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';

import { formatDayShort } from './traveller-format';

/**
 * Self-service date change (review 10.4, promoted from V2): inside the free-
 * cancellation window the traveller picks another OPEN departure of the SAME
 * tour and the move happens immediately - no ops queue, because inside the
 * window they could already cancel for a full refund and rebook.
 *
 * Options load on demand (a click), not with the card: most expands never
 * touch this, and the options read is a session-gated fetch per booking.
 */
export function TravellerDateChange({
    booking,
    dict,
    locale,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    locale: Locale;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<DateChangeOption[] | null>(null);
    const [selected, setSelected] = useState('');
    const [moving, setMoving] = useState(false);
    const [failed, setFailed] = useState(false);

    async function openPicker() {
        setOpen(true);
        setFailed(false);
        if (options !== null || loading) return;
        setLoading(true);
        const opts = await getDateChangeOptionsClient(booking.publicRef);
        setOptions(opts);
        setSelected(opts[0]?.departureId ?? '');
        setLoading(false);
    }

    async function submit() {
        if (moving || !selected) return;
        setMoving(true);
        setFailed(false);
        const ok = await changeDateClient(booking.publicRef, selected);
        setMoving(false);
        if (!ok) {
            setFailed(true);
            return;
        }
        setOpen(false);
        // Re-render from the server: the card moves groups, dates, deadlines.
        router.refresh();
    }

    const optionLabel = (o: DateChangeOption) =>
        [formatDayShort(o.date, locale), o.startTime]
            .filter(Boolean)
            .join(' · ');

    return (
        <div>
            <AnimatePresence mode='wait' initial={false}>
                {open ? (
                    <motion.div
                        key='picker'
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={crossFade}
                        className='rounded-[12px] bg-it-surface p-4'>
                        <p className='m-0 text-[13px] leading-[1.6] font-medium text-it-heading tracking-[-0.012em]'>
                            {dict.dateChangeTitle}
                        </p>
                        <p className='mt-1 mb-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                            {dict.dateChangeNote}
                        </p>
                        {loading ? (
                            <p className='mt-3 mb-0 flex items-center gap-2 text-[12.5px] text-it-text-muted tracking-[-0.012em]'>
                                <Loader2
                                    className='size-4 animate-spin'
                                    strokeWidth={2}
                                />
                                {dict.dateChangeLoading}
                            </p>
                        ) : options && options.length === 0 ? (
                            <p className='mt-3 mb-0 text-[12.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                {dict.dateChangeNoOptions}
                            </p>
                        ) : options ? (
                            <>
                                <select
                                    value={selected}
                                    onChange={e => setSelected(e.target.value)}
                                    aria-label={dict.dateChangeTitle}
                                    className='mt-3 w-full cursor-pointer rounded-[10px] border border-it-border bg-it-white px-3.5 py-2.5 text-[14.5px] md:text-[13px] text-it-heading focus:border-transparent focus:outline-2 focus:outline-it-primary tracking-[-0.012em]'>
                                    {options.map(o => (
                                        <option
                                            key={o.departureId}
                                            value={o.departureId}>
                                            {optionLabel(o)}
                                        </option>
                                    ))}
                                </select>
                                {failed && (
                                    <p
                                        role='alert'
                                        className='mt-2 mb-0 text-[12px] text-it-error tracking-[-0.012em]'>
                                        {dict.dateChangeFailed}
                                    </p>
                                )}
                            </>
                        ) : null}
                        <div className='mt-3 flex flex-wrap gap-2.5'>
                            {options && options.length > 0 && (
                                <motion.button
                                    type='button'
                                    disabled={moving}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => void submit()}
                                    className='rounded-full bg-it-primary px-4.5 py-2.25 text-[13px] font-medium text-it-primary-fg transition-[filter] hover:brightness-95 disabled:opacity-60 tracking-[-0.012em]'>
                                    {moving
                                        ? dict.dateChangeMoving
                                        : dict.dateChangeConfirm}
                                </motion.button>
                            )}
                            <motion.button
                                type='button'
                                disabled={moving}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setOpen(false)}
                                className='rounded-full px-4.5 py-2.25 text-[13px] font-medium text-it-text-muted transition-colors hover:text-it-heading disabled:opacity-60 tracking-[-0.012em]'>
                                {dict.dateChangeKeep}
                            </motion.button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        key='trigger'
                        type='button'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={crossFade}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => void openPicker()}
                        className='rounded-full border-[1.5px] border-it-heading/20 px-4.5 py-2.25 text-[13px] font-medium text-it-heading transition-colors hover:border-it-heading/40 tracking-[-0.012em]'>
                        {dict.dateChangeCta}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

