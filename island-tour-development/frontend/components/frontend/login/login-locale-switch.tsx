'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useClickOutside } from '@/components/frontend/navbar/lib/use-click-outside';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    isLocale,
    type Locale,
} from '@/lib/constants/locales';

/**
 * Locale switcher for the non-localized login surfaces (e.g. `/bookings`, spec
 * 2.1 - locale via cookie/Accept-Language, no path prefix). Visually matches the
 * navbar `LocaleSelector` (globe + uppercase code + dropdown) but sets the
 * NEXT_LOCALE cookie and refreshes instead of swapping a path segment.
 */
export function LoginLocaleSwitch() {
    const router = useRouter();
    const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    // Resolve the current locale from the cookie on mount (client-only).
    useEffect(() => {
        const match = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${LOCALE_COOKIE}=`))
            ?.split('=')[1];
        if (isLocale(match)) setLocale(match);
    }, []);

    function switchLocale(next: Locale) {
        setOpen(false);
        if (next === locale) return;
        setLocale(next);
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        router.refresh();
    }

    return (
        <div ref={ref} className='relative'>
            <button
                type='button'
                onClick={() => setOpen((v) => !v)}
                aria-label='Change language'
                aria-expanded={open}
                className='flex items-center gap-2 rounded-full border border-it-border bg-it-white px-3.5 py-2 text-it-ink transition-shadow hover:shadow-it-sm'>
                <Image
                    src='/icons/nav-globe.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4.5 shrink-0'
                />
                <span className='text-[14px] font-semibold uppercase'>{locale}</span>
            </button>

            {open && (
                <ul className='absolute right-0 top-[calc(100%+10px)] z-50 m-0 min-w-45 origin-top-right list-none overflow-hidden rounded-it-lg border border-it-border bg-it-white p-0 shadow-it-lg'>
                    {ALL_LOCALES.map((code) => (
                        <li key={code}>
                            <button
                                type='button'
                                onClick={() => switchLocale(code)}
                                aria-current={code === locale}
                                className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-5 py-3 text-left text-sm transition-colors hover:bg-it-surface ${code === locale ? 'font-medium text-it-primary' : 'text-it-ink'}`}>
                                <span>{LOCALE_NATIVE_LABELS[code]}</span>
                                <span className='text-xs uppercase text-it-ink-muted'>{code}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
