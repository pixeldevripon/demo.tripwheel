'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';

import type { HeroDestination } from './lib/hero.types';

/** Diacritic-insensitive lowercase, so "curacao" matches "Curaçao". */
const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

/**
 * Homepage hero search - an island/destination picker (NOT tour search). Filters
 * the active destinations client-side as the user types and navigates to the
 * chosen destination page; Enter picks the top match.
 */
export function HeroSearch({
    destinations,
    locale,
    placeholder,
}: {
    destinations: HeroDestination[];
    locale: Locale;
    placeholder: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const matches = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return destinations;
        return destinations.filter(d => normalize(d.name).includes(q));
    }, [query, destinations]);

    // Close the dropdown on an outside pointerdown.
    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const go = (slug: string) => {
        setOpen(false);
        router.push(localizeHref(locale, `/${slug}`));
    };

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const top = matches[0];
        if (top) go(top.slug);
    }

    return (
        <div ref={ref} className='relative w-full'>
            <form
                onSubmit={submit}
                role='search'
                className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full h-15 md:h-20 pl-5 md:pl-9 pr-2.5 md:pr-3'>
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
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className='flex-1 border-none outline-none bg-transparent text-base tracking-[-0.012em] text-it-ink placeholder:text-it-hero-text'
                    />
                </div>
                <motion.button
                    type='submit'
                    aria-label='Search'
                    className='shrink-0 flex items-center justify-center size-10 md:size-12.5 rounded-it-full bg-it-primary hover:bg-it-primary-hover transition-colors border-none cursor-pointer'
                    initial='rest'
                    whileHover='hover'
                    whileTap='tap'
                    animate='rest'
                    variants={{ rest: { scale: 1 }, hover: { scale: 1.06 }, tap: { scale: 0.92 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <motion.span
                        className='inline-flex'
                        variants={{ rest: { x: 0 }, hover: { x: 3 }, tap: { x: 7 } }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                        <Image
                            src='/icons/hero-arrow-right.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-5 md:size-6'
                        />
                    </motion.span>
                </motion.button>
            </form>

            {open && matches.length > 0 && (
                <ul className='absolute left-0 right-0 top-[calc(100%+8px)] z-50 m-0 list-none overflow-hidden rounded-it-lg border border-it-border bg-it-white p-0 shadow-it-lg text-left'>
                    {matches.map(d => (
                        <li key={d.slug}>
                            <button
                                type='button'
                                onClick={() => go(d.slug)}
                                className='flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-it-ink bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface'>
                                <Image
                                    src='/icons/hero-location.svg'
                                    alt=''
                                    width={18}
                                    height={18}
                                    className='size-4.5 shrink-0'
                                />
                                {d.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
