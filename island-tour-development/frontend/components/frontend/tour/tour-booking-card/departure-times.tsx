'use client';

import { motion } from 'framer-motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { springPop } from '@/lib/motion';
import { Collapse } from './collapse';
import { formatTime } from './lib/booking.utils';

/**
 * Departure-time chips (first 3 slots), revealed once a date is picked. Each chip
 * shows the localized start time plus a state note (selected / sold out / "Only N
 * left"); sold-out slots render disabled.
 */
export function DepartureTimes() {
    const { dict, locale, data, selectedDate, selectedTime, selectTime } =
        useBooking();

    return (
        <Collapse open={selectedDate != null && data.slots.length > 0}>
            <div className='grid grid-cols-3 gap-2'>
                {data.slots.slice(0, 3).map(slot => {
                    const isSelected = selectedTime === slot.time;
                    const soldOut = slot.status === 'sold_out';
                    const note = isSelected
                        ? dict.selected
                        : soldOut
                          ? dict.soldOut
                          : slot.remaining != null
                            ? dict.onlyLeft.replace(
                                  '{count}',
                                  String(slot.remaining)
                              )
                            : null;
                    return (
                        <motion.button
                            key={slot.time}
                            type='button'
                            disabled={soldOut}
                            onClick={() => selectTime(slot.time)}
                            whileTap={soldOut ? undefined : { scale: 0.97 }}
                            transition={springPop}
                            className={`flex flex-col items-center gap-[3px] rounded-[8px] bg-it-white px-4 py-2 transition-colors duration-300 ${
                                isSelected
                                    ? 'border border-it-primary'
                                    : 'border border-transparent'
                            } ${
                                soldOut
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer'
                            }`}>
                            <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {formatTime(slot.time, locale)}
                            </span>
                            {note && (
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {note}
                                </span>
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </Collapse>
    );
}
