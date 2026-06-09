'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type HeroDict = {
    toursActivities: string;
    subtitle: string;
    searchPlaceholder: string;
    selectDate: string;
    popularLabel: string;
};

type PopularItem = { label: string; slug: string };

export function DestinationHero({
    destinationName,
    dict,
    locale,
    popular,
    image,
}: {
    destinationName: string;
    dict: HeroDict;
    locale: Locale;
    popular: PopularItem[];
    /** Optional background photo — falls back to the shared home-hero gradient. */
    image?: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);

    function submitSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const params = new URLSearchParams();
        const q = query.trim();
        if (q) params.set('q', q);
        if (date) params.set('date', format(date, 'yyyy-MM-dd'));
        const qs = params.toString();
        router.push(`${localizeHref(locale, '/search')}${qs ? `?${qs}` : ''}`);
    }

    return (
        // Same shell as the home hero: bottom-anchored on mobile, centred on desktop.
        <section className='relative h-136.75 md:h-150 flex items-end justify-center overflow-hidden bg-it-hero-bg [background-image:var(--it-hero-gradient)] pb-12 md:items-center md:pb-0'>
            {image && (
                <Image src={image} alt={destinationName} fill priority className='object-cover' />
            )}

            <div className='it-container w-full flex justify-center'>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
                    className='relative z-10 flex w-full max-w-170.75 flex-col items-center gap-10'>
                    {/* Heading group — title + subtitle, gap 4 */}
                    <div className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-hero-heading'>
                            {destinationName} {dict.toursActivities}
                        </h1>
                        <p className='m-0 max-w-138 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                            {dict.subtitle}
                        </p>
                    </div>

                    {/* Search group — pill + popular, gap 16 */}
                    <div className='flex w-full flex-col items-center gap-4'>
                        <form
                            onSubmit={submitSearch}
                            role='search'
                            className='flex h-15 w-full items-center gap-2 rounded-it-full border border-it-search-border bg-it-white pl-5 pr-2 md:h-20 md:gap-0 md:pl-9 md:pr-5'>
                            {/* Search field — fills the left region */}
                            <input
                                type='search'
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={dict.searchPlaceholder}
                                aria-label={dict.searchPlaceholder}
                                className='min-w-0 flex-1 bg-transparent border-none outline-none text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                            />

                            {/* Vertical divider — between search field and date (mobile + desktop) */}
                            <span className='mx-4 h-8.5 w-px shrink-0 bg-it-heading md:mx-8' />

                            {/* Date picker — "Select date" text on both mobile and desktop */}
                            <Popover open={dateOpen} onOpenChange={setDateOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type='button'
                                        aria-label={dict.selectDate}
                                        className={`flex shrink-0 cursor-pointer items-center whitespace-nowrap border-none bg-transparent p-0 text-left text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] ${date ? 'text-it-heading' : 'text-it-text-muted'}`}>
                                        {date ? format(date, 'd MMM yyyy') : dict.selectDate}
                                    </button>
                                </PopoverTrigger>
                                {/* Light theme + 8px radius applied via props for this instance —
                                    the shared Calendar/Popover defaults are left unchanged. */}
                                <PopoverContent
                                    align='start'
                                    sideOffset={28}
                                    className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading'>
                                    <Calendar
                                        mode='single'
                                        selected={date}
                                        onSelect={(selected) => {
                                            setDate(selected);
                                            setDateOpen(false);
                                        }}
                                        disabled={{ before: new Date() }}
                                        autoFocus
                                        className='bg-it-white [--cell-radius:8px]'
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* Flexible gap — pushes the action button to the right (desktop) */}
                            <div className='hidden flex-1 md:block' />

                            {/* Orange action button */}
                            <motion.button
                                type='submit'
                                aria-label={dict.searchPlaceholder}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.94 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                className='grid size-10 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-primary'>
                                <Image
                                    src='/icons/hero-search-white.svg'
                                    alt=''
                                    width={18}
                                    height={18}
                                    className='size-4.5'
                                />
                            </motion.button>
                        </form>

                        {/* Popular — label muted, names dark links, dots muted */}
                        <p className='m-0 text-center text-sm md:text-base leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                            {dict.popularLabel}:{' '}
                            {popular.map((item, i) => (
                                <span key={item.slug}>
                                    {i > 0 && <span className='mx-1.5'>·</span>}
                                    <Link
                                        href={`${localizeHref(locale, '/search')}?q=${encodeURIComponent(item.label)}`}
                                        className='text-it-hero-heading no-underline transition-colors hover:text-it-primary'>
                                        {item.label}
                                    </Link>
                                </span>
                            ))}
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
