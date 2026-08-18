'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { useClickOutside } from '@/components/frontend/navbar/lib/use-click-outside';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    isLocale,
    type Locale,
} from '@/lib/constants/locales';
import { crossFade, springPop } from '@/lib/motion';

/**
 * Locale switcher for the login surfaces. `/bookings` now lives UNDER the
 * locale segment, so switching swaps the first path segment - inside a
 * transition, so the old screen stays up until the new locale has rendered
 * (no skeleton flash), with a gentle pending dim. The cookie is still written
 * so locale-less surfaces and the proxy redirect keep following the choice.
 */
export function LoginLocaleSwitch() {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    // The path is the source of truth for the current locale.
    const seg = pathname.split('/')[1];
    const locale: Locale = isLocale(seg) ? seg : DEFAULT_LOCALE;

    function switchLocale(next: Locale) {
        setOpen(false);
        if (next === locale) return;

        // Secure on https, matching the server-side setter in proxy.ts.
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax${window.location.protocol === 'https:' ? ';secure' : ''}`;

        const segments = pathname.split('/');
        if (isLocale(segments[1])) {
            segments[1] = next;
            const nextPath = segments.join('/') || `/${next}`;
            startTransition(() => {
                router.push(nextPath, { scroll: false });
            });
        } else {
            // Locale-less surface: the cookie is the only signal.
            startTransition(() => {
                router.refresh();
            });
        }
    }

    return (
        <div ref={ref} className='relative'>
            <motion.button
                type='button'
                onClick={() => setOpen(v => !v)}
                aria-label='Change language'
                aria-expanded={open}
                aria-busy={isPending}
                whileTap={{ scale: 0.98 }}
                transition={springPop}
                className={`flex items-center gap-2 rounded-full border border-it-border bg-it-white px-3.5 py-2 text-it-heading transition-[box-shadow,opacity] duration-300 hover:shadow-it-sm ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                <Image
                    src='/icons/nav-globe.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4.5 shrink-0'
                />
                <span className='text-[14px] font-medium uppercase tracking-[-0.012em]'>
                    {locale}
                </span>
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.ul
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={crossFade}
                        className='absolute right-0 top-[calc(100%+10px)] z-50 m-0 min-w-45 origin-top-right list-none overflow-hidden rounded-it-lg border border-it-border bg-it-white p-0 shadow-it-lg'>
                        {ALL_LOCALES.map(code => (
                            <li key={code}>
                                <button
                                    type='button'
                                    onClick={() => switchLocale(code)}
                                    aria-current={code === locale}
                                    className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-5 py-3 text-left text-sm transition-colors hover:bg-it-surface ${code === locale ? 'font-medium text-it-primary tracking-[-0.012em]' : ''}`}>
                                    <span>{LOCALE_NATIVE_LABELS[code]}</span>
                                    <span className='text-xs uppercase text-it-text-muted tracking-[-0.012em]'>
                                        {code}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

