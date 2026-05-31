'use client';

import { Search, MapPin } from 'lucide-react';

const popular = ['Curaçao', 'Aruba', 'Sint Maarten'];

export function Hero() {
    return (
        <section className='relative h-[600px] flex items-center overflow-hidden'>
            {/* Background gradient */}
            <div className='absolute inset-0 bg-gradient-to-br from-[#0a7b8c] via-[#1a9e8f] to-[#0d5c4a]' />
            {/* Sun glow overlay */}
            <div className='absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_50%,rgba(255,220,140,0.12),transparent)]' />
            {/* Bottom fade to page bg */}
            <div className='absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-b from-transparent to-it-bg/50' />

            <div className='it-container relative z-10 w-full'>
                <div className='max-w-2xl'>
                    <h1 className='font-it-display text-[clamp(2rem,4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-white m-0 mb-4'>
                        We didn&apos;t discover the Caribbean.
                        <br />
                        We grew up in it.
                    </h1>

                    <p className='text-lg text-white/85 mb-8 tracking-tight'>
                        Chosen by locals. Made for travelers.
                    </p>

                    {/* Search widget */}
                    <div className='bg-it-white rounded-it-full shadow-it-lg flex items-center gap-3 pr-1.5 pl-6 py-1.5 max-w-[520px]'>
                        <MapPin size={16} className='text-it-ink-muted shrink-0' />
                        <input
                            type='text'
                            placeholder='Which Island?'
                            className='flex-1 border-none outline-none bg-transparent font-it-body text-base text-it-ink tracking-tight placeholder:text-it-ink-placeholder'
                        />
                        <button className='flex items-center gap-2 px-5 py-2.5 bg-it-primary hover:bg-it-primary-hover text-white rounded-it-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-none'>
                            <Search size={14} />
                            Search
                        </button>
                    </div>

                    {/* Popular */}
                    <div className='mt-4 flex items-center gap-2 flex-wrap'>
                        <span className='text-sm text-white/70'>Popular:</span>
                        {popular.map((island, i) => (
                            <span key={island} className='flex items-center gap-2'>
                                <a href='#' className='text-sm text-white/90 underline underline-offset-2 decoration-white/40'>
                                    {island}
                                </a>
                                {i < popular.length - 1 && (
                                    <span className='text-white/40'>·</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
