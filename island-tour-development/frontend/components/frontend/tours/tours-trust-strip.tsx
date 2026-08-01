import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { buildWhatsappUrl } from '@/lib/whatsapp';
import Image from 'next/image';
import { Reveal } from '../reveal';

export type ToursTrustDict = {
    /** The four checkmark lines, in display order. */
    checks: string[];
    /** WhatsApp link label - e.g. "Questions? Chat on WhatsApp →" */
    whatsapp: string;
};

/**
 * All Tours compact trust strip (design v2 .truststrip, master 3.11): a paper
 * band with four green checkmarks and the WhatsApp link - no payment logos,
 * no FAQ. The checks stack vertically on mobile.
 *
 * Reads the WhatsApp number itself (same pattern as FaqSection): the link is
 * hidden entirely when Settings disables the chat or holds no usable number.
 */
export async function ToursTrustStrip({ dict }: { dict: ToursTrustDict }) {
    const site = await getPublicSiteInfo();
    const whatsappUrl = buildWhatsappUrl(
        site.whatsappNumber,
        site.enableWhatsappChat
    );

    return (
        // 56px above (from the pager), 80px below (to the footer) - mockup
        // .truststrip / footer.ft margins.
        <section className='mt-14 mb-20 bg-it-bg py-7'>
            <div className='it-container'>
                <Reveal className='flex flex-wrap items-center justify-between gap-[18px]'>
                    <div className='flex flex-wrap gap-x-[22px] gap-y-2.5 max-md:flex-col'>
                        {dict.checks.map(check => (
                            <span
                                key={check}
                                className='flex items-center gap-2 text-[13.5px] font-semibold leading-[1.6] text-it-ink'>
                                <Image
                                    src='/icons/trust-check-green.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-4 shrink-0'
                                    aria-hidden='true'
                                />
                                {check}
                            </span>
                        ))}
                    </div>

                    {whatsappUrl && (
                        <a
                            href={whatsappUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='whitespace-nowrap text-[13.5px] font-bold leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary'>
                            {dict.whatsapp}
                        </a>
                    )}
                </Reveal>
            </div>
        </section>
    );
}

