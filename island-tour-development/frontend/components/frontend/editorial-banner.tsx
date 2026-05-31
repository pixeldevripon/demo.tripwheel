import { ArrowRight } from 'lucide-react';

const featuredTours = [
    { title: 'Sunset Cruise',  duration: '3h', price: 65 },
    { title: 'Klein Curaçao', duration: '8h', price: 89 },
    { title: 'Buggy Tour',     duration: '4h', price: 75 },
];

export function EditorialBanner() {
    return (
        <section className='it-section bg-it-bg'>
            <div className='it-container'>
                <div className='rounded-it-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[480px]'>
                    {/* Left — editorial copy */}
                    <div className='bg-it-ink flex flex-col justify-between p-10 lg:p-14'>
                        <div>
                            <h2 className='m-0 text-[clamp(2rem,4vw,2.75rem)] font-semibold text-white tracking-[-0.03em] leading-tight'>
                                One island.
                                <br />
                                Endless adventures.
                            </h2>
                            <p className='mt-5 text-base text-white/65 leading-relaxed max-w-sm'>
                                We grew up on these islands. These are the tours we&apos;d book for our own friends.
                            </p>
                        </div>

                        <button className='mt-8 self-start flex items-center gap-2 px-6 py-3 rounded-it-full bg-it-primary hover:bg-it-primary-hover text-white text-sm font-medium transition-colors border-none cursor-pointer'>
                            Explore Curaçao
                            <ArrowRight size={15} />
                        </button>
                    </div>

                    {/* Right — tour list */}
                    <div className='bg-it-white flex flex-col justify-center p-10 lg:p-12 gap-4'>
                        <p className='m-0 mb-2 text-xs font-semibold text-it-ink-muted tracking-widest uppercase'>
                            Our picks
                        </p>
                        {featuredTours.map((tour, i) => (
                            <div
                                key={tour.title}
                                className={[
                                    'flex items-center justify-between py-4 cursor-pointer group',
                                    i < featuredTours.length - 1 ? 'border-b border-it-border' : '',
                                ].join(' ')}
                            >
                                <div>
                                    <p className='m-0 text-lg font-semibold text-it-ink tracking-tight group-hover:text-it-primary transition-colors'>
                                        {tour.title}
                                    </p>
                                    <p className='m-0 mt-0.5 text-sm text-it-ink-muted'>{tour.duration}</p>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <span className='text-base font-bold text-it-ink'>${tour.price}</span>
                                    <div className='size-8 rounded-it-full border border-it-border flex items-center justify-center group-hover:bg-it-primary group-hover:border-it-primary transition-colors'>
                                        <ArrowRight size={14} className='text-it-ink-muted group-hover:text-white transition-colors' />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
