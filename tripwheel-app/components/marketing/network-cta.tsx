import { Reveal } from '@/components/marketing/reveal';

/**
 * Community CTA (Clarasight ref): saturated teal-blue rounded card on the
 * lavender field - copy + white pill left, visual panel right.
 */
export function MarketingNetworkCta() {
    return (
        <section className='border-t border-mk-line bg-mk-canvas px-6 py-mk-half md:px-12'>
            <Reveal>
                <div className='mk-cta-bg grid gap-8 rounded-2xl p-8 md:grid-cols-[1.2fr_1fr] md:items-center md:p-12'>
                    <div>
                        <h2 className='text-mk-title font-medium text-white'>
                            Join the Travel Growth Network
                        </h2>
                        <p className='mt-4 max-w-md text-sm leading-relaxed text-mk-hero-copy'>
                            TripWheel brings forward-thinking agency leaders
                            together to compare playbooks, learn from peers,
                            and stay ahead of what&apos;s next in travel.
                        </p>
                        <a
                            href='#contact'
                            className='mt-8 inline-flex h-10 items-center rounded-full bg-mk-paper px-6 text-sm font-medium text-mk-ink transition-transform hover:scale-[1.03] active:scale-[0.98]'>
                            Apply now
                        </a>
                    </div>

                    <div className='mk-cta-visual relative h-48 overflow-hidden rounded-xl md:h-56'>
                        <div className='absolute right-4 bottom-4 rounded-full border border-mk-ghost-line bg-mk-ghost px-3 py-1 text-2xs font-semibold text-white backdrop-blur-sm'>
                            1,400+ agency leaders
                        </div>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
