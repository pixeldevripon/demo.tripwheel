import Image from 'next/image';
import { AboutExpander } from '../about-expander';
import { Reveal } from '../reveal';

export type AboutDict = {
    title: string;
    description: string;
    learnMore: string;
    readLess: string;
    topThings: string;
    planning: string;
    whyBook: string;
};

export function DestinationAbout({
    destinationName,
    description,
    dict,
}: {
    destinationName: string;
    /**
     * The island's authored About copy. The caller resolves it (CMS value, else
     * the bundled `dict.description`), so this component never decides which
     * source wins.
     */
    description: string;
    dict: AboutDict;
}) {
    return (
        <section className='it-section pt-[32px]! bg-it-surface border-b border-it-heading/5'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10 md:gap-12'>
                    {/* Top Section: Title & Body Copy */}
                    <div className='flex flex-col gap-6 md:gap-8'>
                        <h2 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.title.replace(
                                '{destination}',
                                destinationName
                            )}
                        </h2>

                        <AboutExpander
                            description={description}
                            moreLabel={dict.learnMore}
                            lessLabel={dict.readLess}
                            className='m-0 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-text-muted'
                            buttonClassName='ml-1.5 inline cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors duration-300 hover:text-it-primary'
                        />
                    </div>

                    {/* Bottom Section: Three Columns & Divider Line */}
                    <div className='flex flex-col gap-10 md:gap-12'>
                        {/* 3 Horizontal navigation columns */}
                        <div className='flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 md:gap-0 w-full'>
                            <a
                                href='#experiences'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.topThings}
                                </span>
                            </a>

                            <a
                                href='#planning'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.planning}
                                </span>
                            </a>

                            <a
                                href='#faq'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.whyBook}
                                </span>
                            </a>
                        </div>

                        {/* Divider line matching Line 18 in Figma (rgba(44,44,44,0.1) opacity stroke) */}
                        <div className='w-full h-px bg-it-heading/10' />
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

