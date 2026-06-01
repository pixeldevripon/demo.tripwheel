import Image from 'next/image';

type Island = {
    name: string;
    tours: number;
    image: string;
};

const islands: Island[] = [
    { name: 'Curaçao', tours: 42, image: '/images/home-page/islands/curacao.jpg' },
    { name: 'Aruba', tours: 42, image: '/images/home-page/islands/aruba.jpg' },
    { name: 'Sint Maarten', tours: 42, image: '/images/home-page/islands/sint-maarten.jpg' },
    { name: 'Saint Lucia', tours: 42, image: '/images/home-page/islands/saint-lucia.jpg' },
];

export function ExploreIslands() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <div className='flex flex-col gap-12'>
                    <h2 className='m-0 font-medium text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        Explore our islands
                    </h2>

                    {/* Peek scroller — bleeds to the right container edge */}
                    <div className='it-scroll-x gap-6 pb-1 -mr-4 md:-mr-8 xl:-mr-30'>
                        {islands.map((island) => (
                            <a
                                key={island.name}
                                href='#'
                                className='group relative block h-90.25 w-96 shrink-0 overflow-hidden rounded-it-lg bg-it-border'
                            >
                                <Image
                                    src={island.image}
                                    alt={island.name}
                                    fill
                                    sizes='384px'
                                    className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                />

                                {/* Bottom gradient scrim — transparent → #1a1a1a */}
                                <div className='pointer-events-none absolute inset-x-0 bottom-0 h-61.75 bg-linear-to-b from-transparent to-it-ink' />

                                <div className='absolute bottom-6 left-6 flex flex-col gap-2'>
                                    <span className='font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-white'>
                                        {island.name}
                                    </span>
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white/70'>
                                        {island.tours} tours
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
