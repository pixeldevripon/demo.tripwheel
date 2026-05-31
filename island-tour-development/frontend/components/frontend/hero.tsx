'use client';

import Image from 'next/image';

export function Hero() {
    return (
        <section className='relative h-150 flex items-center justify-center overflow-hidden bg-it-hero-bg [background-image:var(--it-hero-gradient)]'>
            {/* Centered content — 841px max */}
            <div className='it-container w-full flex justify-center'>
                <div className='flex flex-col items-center gap-10 w-full max-w-220.25'>

                    {/* Heading + subtitle */}
                    <div className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[28px] sm:text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-hero-heading'>
                            We didn&apos;t discover the Caribbean. We grew up in it.
                        </h1>
                        <p className='m-0 text-lg leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                            Chosen by locals. Made for travelers.
                        </p>
                    </div>

                    {/* Search block */}
                    <div className='flex flex-col items-center gap-4 w-full max-w-171.25'>
                        {/* Search bar */}
                        <div className='flex items-center justify-between gap-2 w-full bg-it-white  rounded-it-full h-14 xs:h-16 md:h-20 pl-9 pr-3'>
                            <div className='flex items-center gap-2 flex-1'>
                                <Image
                                    src='/icons/hero-location.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                                <input
                                    type='text'
                                    placeholder='Which Island?'
                                    className='flex-1 border-none outline-none bg-transparent text-base tracking-[-0.012em] text-it-ink placeholder:text-it-hero-text'
                                />
                            </div>
                            <button
                                aria-label='Search'
                                className='shrink-0 flex items-center justify-center size-10 md:size-12.5 rounded-it-full bg-it-primary hover:bg-it-primary-hover transition-colors border-none cursor-pointer'
                            >
                                <Image
                                    src='/icons/hero-arrow-right.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-5 md:size-6'
                                />
                            </button>
                        </div>

                        {/* Popular */}
                        <p className='m-0 text-base tracking-[-0.012em]'>
                            <span className='text-it-hero-text'>Popular: </span>
                            <span className='text-it-hero-heading'>Curaçao · Aruba · Sint Maarten</span>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
