'use client';

import { Sunset, Sailboat, Car, Waves, Fish, Camera, Anchor, Mountain } from 'lucide-react';

const categories = [
    { label: 'Sunset Cruise',       icon: Sunset   },
    { label: 'Catamaran Trip',      icon: Sailboat  },
    { label: 'Buggy Tour',          icon: Car       },
    { label: 'Snorkeling',          icon: Waves     },
    { label: 'Dolphin Encounters',  icon: Fish      },
    { label: 'Photography',         icon: Camera    },
    { label: 'Sailing',             icon: Anchor    },
    { label: 'Hiking',              icon: Mountain  },
];

const tours = [
    { title: 'Sunset Catamaran Cruise',   island: 'Curaçao', price: 65, rating: 4.9, reviews: 312, duration: '3h', badge: 'Bestseller' },
    { title: 'Klein Curaçao Day Trip',    island: 'Curaçao', price: 89, rating: 4.8, reviews: 187, duration: '8h', badge: 'Top Rated'  },
    { title: 'Off-Road Buggy Adventure',  island: 'Aruba',   price: 75, rating: 4.7, reviews: 243, duration: '4h', badge: null        },
    { title: 'Snorkeling at Tugboat',     island: 'Curaçao', price: 45, rating: 4.9, reviews: 421, duration: '2h', badge: 'Top Rated'  },
];

function TourCard({ tour }: { tour: typeof tours[0] }) {
    return (
        <div className='it-card group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-it-lg'>
            {/* Image */}
            <div className='h-48 bg-linear-to-br from-[#0a7b8c] via-[#1a9e8f] to-[#0d5c4a] relative'>
                {tour.badge && (
                    <span className='absolute top-3 left-3 px-2.5 py-1 bg-it-primary text-white rounded-it-full text-xs font-semibold tracking-wide'>
                        {tour.badge}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className='p-4'>
                <h3 className='m-0 text-base font-semibold text-it-ink tracking-tight leading-snug'>
                    {tour.title}
                </h3>
                <p className='mt-1 mb-3 text-sm text-it-ink-muted'>
                    {tour.island} · {tour.duration}
                </p>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5'>
                        <span className='text-(--it-star-filled) text-sm'>★</span>
                        <span className='text-sm font-semibold text-it-ink'>{tour.rating}</span>
                        <span className='text-sm text-it-ink-muted'>({tour.reviews})</span>
                    </div>
                    <div>
                        <span className='text-xs text-it-ink-muted'>from </span>
                        <span className='text-lg font-bold text-it-ink'>${tour.price}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TopExperiences() {
    return (
        <section className='it-section bg-it-bg'>
            <div className='it-container'>
                <h2 className='m-0 mb-8 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold text-it-ink tracking-[-0.03em]'>
                    Top island experiences
                </h2>

                {/* Category filter pills */}
                <div className='flex gap-2.5 flex-wrap mb-10'>
                    {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.label}
                                className='flex items-center gap-2 px-4 py-2 rounded-it-full border border-it-border bg-it-white text-it-ink text-sm font-medium cursor-pointer transition-all hover:bg-it-primary-subtle hover:border-it-primary hover:text-it-primary whitespace-nowrap'
                            >
                                <Icon size={15} />
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tour grid */}
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                    {tours.map((tour) => (
                        <TourCard key={tour.title} tour={tour} />
                    ))}
                </div>

                {/* View all */}
                <div className='mt-10 flex justify-center'>
                    <button className='px-8 py-3 rounded-it-full border-[1.5px] border-it-ink bg-transparent text-it-ink text-base font-medium cursor-pointer tracking-tight transition-all hover:bg-it-ink hover:text-it-white'>
                        View all experiences
                    </button>
                </div>
            </div>
        </section>
    );
}
