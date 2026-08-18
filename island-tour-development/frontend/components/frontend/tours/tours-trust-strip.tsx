import Image from 'next/image';

import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { buildWhatsappUrl } from '@/lib/whatsapp';

import { Reveal } from '../reveal';

/** One trust item: a bold lead line over a muted continuation. */
export type ToursTrustItem = {
    title: string;
    /** Second line, muted. */
    sub: string;
};

export type ToursTrustDict = {
    /** The four items, in display order. */
    checks: ToursTrustItem[];
    /** WhatsApp link label - e.g. "Questions? Chat on WhatsApp →" */
    whatsapp: string;
};

/**
 * All Tours trust strip - Figma 47626:9337 (`Trust strip/ D`).
 *
 * Four icon + two-line columns spread across the container on a #f8f8f8 band.
 * Each column is a 24px glyph with 16px of air, then a 16px/510 lead line in
 * ink over a 16px/400 continuation in #767676.
 *
 * This replaces a row of green ticks with a trailing WhatsApp link. The ticks
 * were one repeated glyph; the design gives each item its own - people, a
 * check, a chat bubble, a wallet - so the four read as four different promises
 * rather than one list.
 *
 * Icons are the Figma exports at their #2C2C2C, rendered through next/image at
 * intrinsic size (CLAUDE.md: never inline SVG, never a lucide stand-in, and the
 * baked colour is not recolourable by a text utility).
 *
 * The old trailing WhatsApp link is gone - item THREE carries that message now
 * ("We're locals / message us on WhatsApp"), and its second line is the link
 * itself. The number is read here rather than passed in, same as FaqSection:
 * when Settings disables the chat or holds no usable number the line stays as
 * plain text instead of becoming a dead anchor. `dict.whatsapp` remains on the
 * type because the FAQ section still renders it.
 */
export async function ToursTrustStrip({ dict }: { dict: ToursTrustDict }) {
    const site = await getPublicSiteInfo();
    const whatsappUrl = buildWhatsappUrl(
        site.whatsappNumber,
        site.enableWhatsappChat
    );
    const icons = [
        '/icons/tours-trust-locals.svg',
        '/icons/tours-trust-cancel.svg',
        '/icons/tours-trust-chat.svg',
        '/icons/tours-trust-wallet.svg',
    ];

    return (
        // Figma: a full-bleed #f8f8f8 band. The 56px above (from the pager) and
        // 80px below (to the footer) are the mockup's .truststrip margins.
        <section className=' bg-it-surface py-14'>
            <div className='it-container'>
                {/* Figma spreads the four columns edge to edge on a 1200px row
                    (147px of air between them). `justify-between` reproduces
                    that at any container width instead of pinning the gap.
                    Below md it is a 2x2 grid: wrapping a flex row left the
                    third and fourth items hanging on their own lines at
                    different widths. */}
                <Reveal
                    className='grid grid-cols-2 items-start gap-x-6 gap-y-7 md:flex md:justify-between md:gap-x-10'
                    listItem>
                    {dict.checks.map((item, i) => (
                        <div
                            key={item.title}
                            className='flex min-w-0 items-start gap-4'>
                            <Image
                                src={icons[i] ?? icons[0]}
                                alt=''
                                aria-hidden='true'
                                width={24}
                                height={24}
                                className='size-5 shrink-0 md:size-6'
                            />
                            <span className='flex min-w-0 flex-col'>
                                <span className='it-text font-medium text-it-heading '>
                                    {item.title}
                                </span>
                                {item.sub &&
                                    // Item three is the WhatsApp promise, so its
                                    // second line IS the link.
                                    (i === 2 && whatsappUrl ? (
                                        <a
                                            href={whatsappUrl}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='w-fit it-text text-it-text-muted underline underline-offset-[3px] transition-colors duration-(--it-duration-md) ease-(--it-ease-out) hover:text-it-primary '>
                                            {item.sub}
                                        </a>
                                    ) : (
                                        <span className='it-text text-it-text-muted '>
                                            {item.sub}
                                        </span>
                                    ))}
                            </span>
                        </div>
                    ))}
                </Reveal>
            </div>
        </section>
    );
}

