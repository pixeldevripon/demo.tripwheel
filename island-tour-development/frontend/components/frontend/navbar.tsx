'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    ALL_LOCALES,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    localeFlag,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';

// Pre-defined islands — explicit slugs (not generated at click time).
const islands: { name: string; slug: string }[] = [
    { name: 'Curaçao', slug: 'curacao' },
    { name: 'Aruba', slug: 'aruba' },
    { name: 'Sint Maarten', slug: 'sint-maarten' },
    { name: 'Saint Lucia', slug: 'saint-lucia' },
    { name: 'Bonaire', slug: 'bonaire' },
];

type NavDict = {
    selectIsland: string;
    wishlist: string;
    account: string;
    menu: string;
    close: string;
    language: string;
};

const springFast = { type: 'spring', stiffness: 400, damping: 17 } as const;

export function Navbar({ locale, dict }: { locale: Locale; dict: NavDict }) {
    const pathname = usePathname();
    const router = useRouter();

    const [islandOpen, setIslandOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const islandRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);

    // Close any open dropdown when clicking outside of it.
    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (islandRef.current && !islandRef.current.contains(target)) {
                setIslandOpen(false);
            }
            if (langRef.current && !langRef.current.contains(target)) {
                setLangOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    // Switch locale: swap the first path segment, remember the choice, navigate.
    function switchLocale(next: Locale) {
        setLangOpen(false);
        setMobileOpen(false);
        if (next === locale) return;

        const segments = pathname.split('/');
        segments[1] = next; // [0] is '' (leading slash), [1] is the locale
        const nextPath = segments.join('/') || `/${next}`;

        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        router.push(nextPath);
    }

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-20 bg-it-white border-b border-it-border'>
            <div className='it-container h-full flex items-center justify-between'>
                {/* ── Left: Logo + Island selector ── */}
                <div className='flex items-center gap-12'>
                    <Link href={localizeHref(locale, '/')} className='shrink-0'>
                        <Image
                            src='/logo/logo.png'
                            alt='Island Tours'
                            width={68}
                            height={50}
                            priority
                            className='object-contain'
                        />
                    </Link>

                    {/* Island selector */}
                    <div ref={islandRef} className='relative hidden md:block'>
                        <button
                            onClick={() => {
                                setLangOpen(false);
                                setIslandOpen((v) => !v);
                            }}
                            aria-expanded={islandOpen}
                            className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/nav-location.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className='text-base font-medium text-it-ink'>
                                {dict.selectIsland}
                            </span>
                        </button>

                        <AnimatePresence>
                            {islandOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className='absolute top-[calc(100%+12px)] left-0 min-w-45 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {islands.map((island) => (
                                        <Link
                                            key={island.slug}
                                            href={localizeHref(locale, `/${island.slug}`)}
                                            onClick={() => setIslandOpen(false)}
                                            className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                            {island.name}
                                        </Link>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── Right: Language + Wishlist + Account ── */}
                <div className='hidden md:flex items-center gap-6'>
                    {/* Language switcher */}
                    <div ref={langRef} className='relative'>
                        <button
                            onClick={() => {
                                setIslandOpen(false);
                                setLangOpen((v) => !v);
                            }}
                            aria-label={dict.language}
                            aria-expanded={langOpen}
                            className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src={localeFlag(locale)}
                                alt=''
                                width={20}
                                height={15}
                                className='rounded-[2px] object-cover border border-it-border shrink-0'
                            />
                            <span className='text-base font-medium text-it-ink uppercase'>
                                {locale}
                            </span>
                        </button>

                        <AnimatePresence>
                            {langOpen && (
                                <motion.ul
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className='absolute top-[calc(100%+12px)] right-0 m-0 p-0 list-none min-w-45 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {ALL_LOCALES.map((code) => (
                                        <li key={code}>
                                            <button
                                                onClick={() => switchLocale(code)}
                                                aria-current={code === locale}
                                                className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface ${code === locale ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                                <div className='flex items-center gap-2.5'>
                                                    <Image
                                                        src={localeFlag(code)}
                                                        alt=''
                                                        width={20}
                                                        height={15}
                                                        className='rounded-[2px] object-cover border border-it-border shrink-0'
                                                    />
                                                    <span>{LOCALE_NATIVE_LABELS[code]}</span>
                                                </div>
                                                <span className='uppercase text-xs text-it-ink-muted'>
                                                    {code}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className='w-px h-5 bg-it-border' />

                    <button
                        aria-label={dict.wishlist}
                        className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                        <Image
                            src='/icons/nav-heart.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </button>

                    <div className='w-px h-5 bg-it-border' />

                    <Link
                        href='/login'
                        aria-label={dict.account}
                        className='flex items-center no-underline'>
                        <span className='inline-flex'>
                            <Image
                                src='/icons/nav-profile.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6'
                            />
                        </span>
                    </Link>
                </div>

                {/* ── Mobile toggle ── */}
                <motion.button
                    className='md:hidden bg-transparent border-none cursor-pointer p-1 text-it-ink'
                    whileTap={{ scale: 0.85 }}
                    transition={springFast}
                    aria-label={mobileOpen ? dict.close : dict.menu}
                    onClick={() => setMobileOpen((v) => !v)}>
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                            key={mobileOpen ? 'close' : 'open'}
                            className='inline-flex'
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.18 }}>
                            {mobileOpen ? (
                                <X size={22} strokeWidth={1.5} />
                            ) : (
                                <Menu size={22} strokeWidth={1.5} />
                            )}
                        </motion.span>
                    </AnimatePresence>
                </motion.button>
            </div>

            {/* ── Mobile menu ── */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                            duration: 0.28,
                            ease: [0.04, 0.62, 0.23, 0.98],
                        }}
                        className='absolute top-20 left-0 right-0 overflow-hidden bg-it-white border-b border-it-border z-50'>
                        <div className='border-t border-it-border px-6 py-6 flex flex-col gap-4'>
                            {islands.map((island, i) => (
                                <motion.div
                                    key={island.slug}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.06 + i * 0.05,
                                        duration: 0.25,
                                    }}>
                                    <Link
                                        href={localizeHref(locale, `/${island.slug}`)}
                                        onClick={() => setMobileOpen(false)}
                                        className='text-it-ink text-base no-underline py-1'>
                                        {island.name}
                                    </Link>
                                </motion.div>
                            ))}

                            <div className='h-px bg-it-border' />

                            {/* Language chooser */}
                            <div className='flex flex-wrap gap-2'>
                                {ALL_LOCALES.map((code) => (
                                    <button
                                        key={code}
                                        onClick={() => switchLocale(code)}
                                        aria-current={code === locale}
                                        className={`flex items-center gap-2 rounded-it-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${code === locale ? 'border-it-primary text-it-primary font-medium bg-it-primary/5' : 'border-it-border text-it-ink bg-transparent'}`}>
                                        <Image
                                            src={localeFlag(code)}
                                            alt=''
                                            width={16}
                                            height={12}
                                            className='w-4 h-3 rounded-[2px] object-cover border border-it-border shrink-0'
                                        />
                                        {LOCALE_NATIVE_LABELS[code]}
                                    </button>
                                ))}
                            </div>

                            <div className='h-px bg-it-border' />

                            <div className='flex items-center gap-6'>
                                <button
                                    aria-label={dict.wishlist}
                                    className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                                    <Image
                                        src='/icons/nav-heart.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5'
                                    />
                                </button>
                                <Link
                                    href='/login'
                                    aria-label={dict.account}
                                    onClick={() => setMobileOpen(false)}
                                    className='flex items-center no-underline'>
                                    <Image
                                        src='/icons/nav-profile.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5'
                                    />
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
