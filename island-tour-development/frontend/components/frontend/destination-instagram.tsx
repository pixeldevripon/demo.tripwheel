import Image from 'next/image';
import { Reveal } from './reveal';

export type InstagramDict = {
    viewMore: string;
};

// Placeholder grid photos — replace with real Instagram feed API data.
const POSTS = [
    {
        src: '/images/home-page/islands/curacao.jpg',
        alt: 'Curaçao island tour',
        href: 'https://www.instagram.com/islandtours',
    },
    {
        src: '/images/home-page/islands/aruba.jpg',
        alt: 'Aruba island tour',
        href: 'https://www.instagram.com/islandtours',
    },
    {
        src: '/images/home-page/islands/sint-maarten.jpg',
        alt: 'Sint Maarten island tour',
        href: 'https://www.instagram.com/islandtours',
    },
    {
        src: '/images/home-page/categories/catamaran-trips.jpg',
        alt: 'Catamaran trip',
        href: 'https://www.instagram.com/islandtours',
    },
    {
        src: '/images/home-page/categories/buggy-tours.jpg',
        alt: 'Buggy tour',
        href: 'https://www.instagram.com/islandtours',
    },
    {
        src: '/images/home-page/categories/snorkel-trips.jpg',
        alt: 'Snorkel trip',
        href: 'https://www.instagram.com/islandtours',
    },
];

export function DestinationInstagram({ dict }: { dict: InstagramDict }) {
    return (
        <section className='it-section pt-[32px]! bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-8 md:gap-10'>
                    {/* Header row — @island.tours_  |  View more on Instagram */}
                    <div className='flex items-center justify-between'>
                        <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            @island.tours_
                        </h2>
                        <a
                            href='https://www.instagram.com/island.tours_'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary-hover'>
                            {dict.viewMore || 'View more on Instagram'}
                        </a>
                    </div>

                    {/* 2 × 3 photo grid */}
                    <div className='grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6'>
                        {POSTS.map((post, i) => (
                            <a
                                key={i}
                                href={post.href}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='group relative block overflow-hidden rounded-[16px] bg-it-surface'
                                style={{ aspectRatio: '384 / 337' }}
                                aria-label={post.alt}>
                                <Image
                                    src={post.src}
                                    alt={post.alt}
                                    fill
                                    sizes='(max-width: 768px) 50vw, 33vw'
                                    className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                />
                                {/* Hover overlay */}
                                <div className='absolute inset-0 bg-it-heading/0 transition-colors duration-300 group-hover:bg-it-heading/20' />
                            </a>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}



