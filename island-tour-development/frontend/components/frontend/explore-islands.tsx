import { ArrowRight } from 'lucide-react';

const islands = [
    { name: 'Curaçao',      tours: 42, gradient: 'from-[#0a7b8c] to-[#1a9e8f]' },
    { name: 'Aruba',        tours: 38, gradient: 'from-[#e8611a] to-[#f5a623]' },
    { name: 'Sint Maarten', tours: 29, gradient: 'from-[#1565c0] to-[#0a7b8c]' },
    { name: 'Saint Lucia',  tours: 24, gradient: 'from-[#2e7d32] to-[#1a9e8f]' },
];

export function ExploreIslands() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10'>
                    <h2 className='m-0 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold text-it-ink tracking-[-0.03em]'>
                        Explore our islands
                    </h2>
                    <button className='shrink-0 flex items-center gap-2 text-sm font-medium text-it-primary hover:gap-3 transition-all'>
                        View all islands <ArrowRight size={15} />
                    </button>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'>
                    {islands.map((island) => (
                        <div
                            key={island.name}
                            className='group relative rounded-it-lg overflow-hidden cursor-pointer h-72'
                        >
                            {/* Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${island.gradient} transition-transform duration-500 group-hover:scale-105`} />
                            {/* Dark overlay */}
                            <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />

                            {/* Content */}
                            <div className='absolute bottom-0 left-0 right-0 p-5'>
                                <h3 className='m-0 text-2xl font-semibold text-white tracking-tight'>
                                    {island.name}
                                </h3>
                                <p className='m-0 mt-1 text-sm text-white/70'>{island.tours} tours</p>
                            </div>

                            {/* Arrow on hover */}
                            <div className='absolute top-4 right-4 size-9 rounded-it-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                                <ArrowRight size={16} className='text-white' />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
