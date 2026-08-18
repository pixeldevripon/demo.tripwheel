import { MotionA } from '@/components/frontend/motion-primitives';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { Lock } from 'lucide-react';

type ThankYouDict = Dictionary['thankYou'];

/**
 * Shown on the TYP ONLY in masked mode (`booking.verified === false`): the
 * visitor opened the bare publicRef link without a traveler session, so the
 * backend masked identity and withheld pickup/card details. This card explains
 * that and routes the real traveler through the /bookings pair login (master
 * 6.4), which comes back with the HttpOnly session that unmasks the page.
 */
export function ThankYouVerifyNotice({
    locale,
    dict,
}: {
    locale: Locale;
    dict: ThankYouDict;
}) {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <MountReveal>
                    <div className='flex flex-col items-start gap-5 rounded-[16px] border border-it-heading/10 bg-it-surface p-6 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex items-start gap-4'>
                            <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-it-primary/8'>
                                <Lock className='size-5 text-it-primary tracking-[-0.012em]' />
                            </span>
                            <div className='flex flex-col gap-1'>
                                <p className='m-0 font-medium text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {dict.verifyTitle}
                                </p>
                                <p className='m-0 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {dict.verifyBody}
                                </p>
                            </div>
                        </div>
                        <MotionA
                            href={localizeHref(locale, '/bookings')}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className='shrink-0 rounded-full bg-it-primary px-7 py-3 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover'>
                            {dict.verifyCta}
                        </MotionA>
                    </div>
                </MountReveal>
            </div>
        </section>
    );
}

