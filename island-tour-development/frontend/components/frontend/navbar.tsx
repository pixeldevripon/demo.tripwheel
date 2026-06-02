'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

// Global categories — explicit slugs (names are proper nouns, not translated here).
const categories: { name: string; slug: string }[] = [
    { name: 'Boat Tours', slug: 'boat-tours' },
    { name: 'Snorkeling', slug: 'snorkeling' },
    { name: 'Catamaran Trips', slug: 'catamaran-trips' },
    { name: 'Buggy Tours', slug: 'buggy-tours' },
    { name: 'Island Hopping', slug: 'island-hopping' },
];

type NavDict = {
    selectIsland: string;
    wishlist: string;
    account: string;
    menu: string;
    close: string;
    language: string;
    categories: string;
    search: string;
};

const springFast = { type: 'spring', stiffness: 400, damping: 17 } as const;

const dropdownMotion = {
    initial: { opacity: 0, y: -8, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.97 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
} as const;

/** Circular flag badge — uniform across locales regardless of flag aspect ratio. */
function Flag({ code, className = 'size-6' }: { code: Locale; className?: string }) {
    return (
        <span
            className={`relative inline-block overflow-hidden rounded-full ring-1 ring-black/10 shrink-0 ${className}`}>
            <Image src={localeFlag(code)} alt='' fill sizes='28px' className='object-cover' />
        </span>
    );
}

/** Location pin — matches the vuesax/linear "location" icon used across the site. */
function LocationIcon({ className = 'size-6' }: { className?: string }) {
    return (
        <Image
            src='/icons/nav-location.svg'
            alt=''
            width={24}
            height={24}
            className={className}
        />
    );
}

/** Categories — exact vuesax/linear "category" icon from Figma (3 rounded tiles + circle). */
function CategoryIcon({ className = 'size-6' }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
            className={className}>
            <path
                fill='currentColor'
                d='M14.6457 11.1379H20.2186C20.4517 11.1387 20.6826 11.0934 20.8981 11.0046C21.1136 10.9158 21.3093 10.7853 21.4741 10.6205C21.6389 10.4557 21.7695 10.2599 21.8583 10.0444C21.9471 9.82892 21.9924 9.598 21.9915 9.36494V3.79201C21.995 3.55596 21.9507 3.32164 21.8611 3.10321C21.7716 2.88478 21.6387 2.68676 21.4705 2.5211C21.3035 2.35465 21.1053 2.22291 20.8871 2.13347C20.669 2.04404 20.4353 1.99869 20.1996 2.00003H14.6457C14.4126 1.99919 14.1817 2.04447 13.9662 2.13327C13.7508 2.22207 13.555 2.35263 13.3902 2.51743C13.2254 2.68223 13.0948 2.87801 13.006 3.09349C12.9172 3.30897 12.8719 3.53989 12.8728 3.77295V9.34588C12.8685 9.58076 12.9114 9.81412 12.9987 10.0322C13.0861 10.2503 13.2162 10.4487 13.3814 10.6157C13.5466 10.7827 13.7436 10.9149 13.9608 11.0046C14.1779 11.0943 14.4108 11.1396 14.6457 11.1379ZM13.8514 3.79201C13.8505 3.68686 13.8704 3.58258 13.9099 3.48512C13.9494 3.38765 14.0076 3.29892 14.0814 3.22398C14.1552 3.14904 14.2429 3.08936 14.3398 3.04836C14.4366 3.00735 14.5406 2.98581 14.6457 2.98498H20.2186C20.3248 2.98414 20.4302 3.00443 20.5285 3.04469C20.6268 3.08495 20.7161 3.14436 20.7912 3.21947C20.8663 3.29458 20.9257 3.38388 20.9659 3.48217C21.0062 3.58047 21.0265 3.68579 21.0257 3.79201V9.36494C21.0265 9.47116 21.0062 9.57648 20.9659 9.67477C20.9257 9.77307 20.8663 9.86237 20.7912 9.93748C20.7161 10.0126 20.6268 10.072 20.5285 10.1123C20.4302 10.1525 20.3248 10.1728 20.2186 10.172H14.6457C14.5395 10.1728 14.4342 10.1525 14.3359 10.1123C14.2376 10.072 14.1483 10.0126 14.0732 9.93748C13.998 9.86237 13.9386 9.77307 13.8984 9.67477C13.8581 9.57648 13.8378 9.47116 13.8387 9.36494L13.8514 3.79201ZM9.35872 12.8917H3.78579C3.55273 12.8909 3.32181 12.9362 3.10633 13.025C2.89086 13.1138 2.69508 13.2443 2.53028 13.4091C2.36548 13.5739 2.23492 13.7697 2.14612 13.9852C2.05732 14.2006 2.01204 14.4316 2.01288 14.6646V20.2693C2.01204 20.5024 2.05732 20.7333 2.14612 20.9488C2.23492 21.1643 2.36548 21.36 2.53028 21.5248C2.69508 21.6896 2.89086 21.8202 3.10633 21.909C3.32181 21.9978 3.55273 22.0431 3.78579 22.0422H9.35872C9.59477 22.0457 9.82909 22.0014 10.0475 21.9118C10.266 21.8223 10.464 21.6894 10.6296 21.5212C10.7961 21.3542 10.9278 21.156 11.0173 20.9378C11.1067 20.7197 11.152 20.486 11.1507 20.2503V14.6646C11.1528 14.4288 11.1077 14.1949 11.0182 13.9767C10.9288 13.7584 10.7967 13.5602 10.6296 13.3937C10.4624 13.229 10.2636 13.0996 10.0453 13.0133C9.82692 12.9271 9.59342 12.8857 9.35872 12.8917ZM10.1975 20.2693C10.1984 20.3755 10.1781 20.4809 10.1378 20.5792C10.0976 20.6775 10.0381 20.7668 9.96304 20.8419C9.88793 20.917 9.79862 20.9764 9.70033 21.0166C9.60203 21.0569 9.49671 21.0772 9.39049 21.0764H3.78579C3.67958 21.0772 3.57425 21.0569 3.47596 21.0166C3.37766 20.9764 3.28836 20.917 3.21325 20.8419C3.13814 20.7668 3.07873 20.6775 3.03847 20.5792C2.99822 20.4809 2.97792 20.3755 2.97877 20.2693V14.6646C2.97792 14.5584 2.99822 14.4531 3.03847 14.3548C3.07873 14.2565 3.13814 14.1672 3.21325 14.0921C3.28836 14.017 3.37766 13.9576 3.47596 13.9173C3.57425 13.877 3.67958 13.8568 3.78579 13.8576H9.35872C9.46757 13.8524 9.57633 13.8695 9.67835 13.9078C9.78036 13.9461 9.87348 14.0048 9.95201 14.0804C10.0305 14.1559 10.0928 14.2467 10.135 14.3472C10.1772 14.4476 10.1985 14.5557 10.1975 14.6646V20.2693ZM9.35872 2.01909H3.78579C3.55009 2.0181 3.31651 2.06361 3.09843 2.15302C2.88035 2.24244 2.68205 2.374 2.51488 2.54016C2.34872 2.70701 2.21758 2.90539 2.12919 3.12364C2.0408 3.3419 1.99693 3.57562 2.00017 3.81107V9.384C1.99848 9.6173 2.04318 9.8486 2.13168 10.0645C2.22018 10.2803 2.35071 10.4764 2.51567 10.6414C2.68064 10.8064 2.87676 10.9369 3.09262 11.0254C3.30849 11.1139 3.53979 11.1586 3.77308 11.1569H9.34601C9.57907 11.1578 9.80999 11.1125 10.0255 11.0237C10.241 10.9349 10.4367 10.8043 10.6015 10.6395C10.7663 10.4747 10.8969 10.2789 10.9857 10.0635C11.0745 9.84798 11.1198 9.61706 11.1189 9.384V3.79201C11.1173 3.32232 10.9299 2.87234 10.5978 2.54022C10.2657 2.20809 9.8157 2.02077 9.34601 2.01909H9.35872ZM10.1975 9.36494C10.1984 9.47116 10.1781 9.57648 10.1378 9.67477C10.0976 9.77307 10.0381 9.86237 9.96304 9.93748C9.88793 10.0126 9.79862 10.072 9.70033 10.1123C9.60203 10.1525 9.49671 10.1728 9.39049 10.172H3.78579C3.67958 10.1728 3.57425 10.1525 3.47596 10.1123C3.37766 10.072 3.28836 10.0126 3.21325 9.93748C3.13814 9.86237 3.07873 9.77307 3.03847 9.67477C2.99822 9.57648 2.97792 9.47116 2.97877 9.36494V3.79201C2.97792 3.68579 2.99822 3.58047 3.03847 3.48217C3.07873 3.38388 3.13814 3.29458 3.21325 3.21947C3.28836 3.14436 3.37766 3.08495 3.47596 3.04469C3.57425 3.00443 3.67958 2.98414 3.78579 2.98498H9.35872C9.46757 2.97979 9.57633 2.99687 9.67835 3.03518C9.78036 3.07348 9.87348 3.13221 9.95201 3.20776C10.0305 3.28331 10.0928 3.3741 10.135 3.47456C10.1772 3.57502 10.1985 3.68304 10.1975 3.79201V9.36494ZM17.4417 12.5486C16.4712 12.5486 15.5224 12.8364 14.7156 13.3758C13.9087 13.9151 13.2799 14.6816 12.9088 15.5784C12.5377 16.4752 12.4409 17.4619 12.6307 18.4137C12.8205 19.3654 13.2884 20.2396 13.9751 20.9254C14.6618 21.6112 15.5365 22.0779 16.4885 22.2665C17.4406 22.4551 18.4271 22.357 19.3234 21.9847C20.2197 21.6124 20.9854 20.9827 21.5237 20.1751C22.062 19.3675 22.3487 18.4184 22.3474 17.4479C22.3457 16.1479 21.8281 14.9018 20.9083 13.9832C19.9885 13.0645 18.7417 12.5486 17.4417 12.5486ZM17.4417 21.3814C16.6637 21.3814 15.9032 21.1507 15.2564 20.7185C14.6095 20.2863 14.1054 19.6719 13.8077 18.9532C13.5099 18.2344 13.432 17.4435 13.5838 16.6805C13.7356 15.9175 14.1102 15.2166 14.6603 14.6665C15.2104 14.1164 15.9113 13.7418 16.6743 13.59C17.4373 13.4383 18.2282 13.5162 18.947 13.8139C19.6657 14.1116 20.28 14.6157 20.7122 15.2626C21.1445 15.9095 21.3752 16.6699 21.3752 17.4479C21.3752 17.9645 21.2734 18.476 21.0757 18.9532C20.8781 19.4304 20.5883 19.864 20.2231 20.2293C19.8578 20.5945 19.4242 20.8843 18.947 21.082C18.4697 21.2796 17.9582 21.3814 17.4417 21.3814Z'
            />
        </svg>
    );
}

/** Search — exact vuesax/linear "search-normal" icon from Figma. */
function SearchIcon({ className = 'size-4.5' }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 18 18'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
            className={className}>
            <path d='M8.625 15.75C12.56 15.75 15.75 12.56 15.75 8.625C15.75 4.68997 12.56 1.5 8.625 1.5C4.68997 1.5 1.5 4.68997 1.5 8.625C1.5 12.56 4.68997 15.75 8.625 15.75Z' />
            <path d='M16.5 16.5L15 15' />
        </svg>
    );
}

export function Navbar({ locale, dict }: { locale: Locale; dict: NavDict }) {
    const pathname = usePathname();
    const router = useRouter();

    const [islandOpen, setIslandOpen] = useState(false);
    const [catOpen, setCatOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const islandRef = useRef<HTMLDivElement>(null);
    const catRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);
    const mobileLangRef = useRef<HTMLDivElement>(null);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);

    // Home keeps the discovery layout ("Select your Island"); every other page
    // shows the inner layout (current island + Categories + search pill).
    const isHome = pathname === '/' || pathname === `/${locale}`;

    // Resolve the active island from the first segment after the locale.
    const currentIsland = useMemo(() => {
        const slug = pathname.split('/')[2];
        return islands.find((i) => i.slug === slug) ?? null;
    }, [pathname]);

    // Category links point into the current island when there is one.
    const categoryHref = (slug: string) =>
        localizeHref(locale, currentIsland ? `/${currentIsland.slug}/${slug}` : `/${slug}`);

    // Submit search → /[locale]/search?q=…
    function submitSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        setMobileSearchOpen(false);
        router.push(`${localizeHref(locale, '/search')}?q=${encodeURIComponent(q)}`);
    }

    // Close any open dropdown when clicking outside of it.
    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (islandRef.current && !islandRef.current.contains(target)) setIslandOpen(false);
            if (catRef.current && !catRef.current.contains(target)) setCatOpen(false);
            const insideLang =
                langRef.current?.contains(target) || mobileLangRef.current?.contains(target);
            if (!insideLang) setLangOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    // Focus the mobile search field as soon as it expands.
    useEffect(() => {
        if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
    }, [mobileSearchOpen]);

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

    const localeOptions = (
        <>
            {ALL_LOCALES.map((code) => (
                <li key={code}>
                    <button
                        onClick={() => switchLocale(code)}
                        aria-current={code === locale}
                        className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface ${code === locale ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                        <span className='flex items-center gap-2.5'>
                            <Flag code={code} className='size-5' />
                            <span>{LOCALE_NATIVE_LABELS[code]}</span>
                        </span>
                        <span className='uppercase text-xs text-it-ink-muted'>{code}</span>
                    </button>
                </li>
            ))}
        </>
    );

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-18 md:h-20 bg-it-white border-b border-it-border'>
            <div className='it-container h-full flex items-center justify-between gap-6'>
                {/* ── Left: Logo + (island / categories) ── */}
                <div className='flex items-center gap-6 lg:gap-12 shrink-0'>
                    <Link href={localizeHref(locale, '/')} className='shrink-0'>
                        <Image
                            src='/logo/logo.png'
                            alt='Island Tours'
                            width={68}
                            height={50}
                            priority
                            className='h-9 w-auto object-contain md:h-12.5'
                        />
                    </Link>

                    {/* Island + Categories selectors — desktop only */}
                    <div className='hidden md:flex items-center gap-4'>
                        {/* Island selector */}
                        <div ref={islandRef} className='relative'>
                            <button
                                onClick={() => {
                                    setLangOpen(false);
                                    setCatOpen(false);
                                    setIslandOpen(v => !v);
                                }}
                                aria-expanded={islandOpen}
                                className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                                <LocationIcon className='size-6 shrink-0' />
                                <span className='text-base font-medium text-it-ink whitespace-nowrap'>
                                    {currentIsland
                                        ? currentIsland.name
                                        : dict.selectIsland}
                                </span>
                            </button>

                            <AnimatePresence>
                                {islandOpen && (
                                    <motion.div
                                        {...dropdownMotion}
                                        className='absolute top-[calc(100%+18px)] left-0 min-w-45 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                        {islands.map(island => (
                                            <Link
                                                key={island.slug}
                                                href={localizeHref(
                                                    locale,
                                                    `/${island.slug}`
                                                )}
                                                onClick={() =>
                                                    setIslandOpen(false)
                                                }
                                                aria-current={
                                                    island.slug ===
                                                    currentIsland?.slug
                                                }
                                                className={`block px-5 py-3 text-sm no-underline hover:bg-it-surface transition-colors ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                                {island.name}
                                            </Link>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Inner pages: divider + Categories dropdown */}
                        {!isHome && (
                            <>
                                <div className='w-px h-5 bg-it-ink/40' />
                                <div ref={catRef} className='relative'>
                                    <button
                                        onClick={() => {
                                            setLangOpen(false);
                                            setIslandOpen(false);
                                            setCatOpen(v => !v);
                                        }}
                                        aria-expanded={catOpen}
                                        className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                                        <CategoryIcon className='size-6 shrink-0' />
                                        <span className='text-base font-medium text-it-ink whitespace-nowrap'>
                                            {dict.categories}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {catOpen && (
                                            <motion.div
                                                {...dropdownMotion}
                                                className='absolute top-[calc(100%+18px)] left-0 min-w-52 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                                {categories.map(cat => (
                                                    <Link
                                                        key={cat.slug}
                                                        href={categoryHref(
                                                            cat.slug
                                                        )}
                                                        onClick={() =>
                                                            setCatOpen(false)
                                                        }
                                                        className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                                        {cat.name}
                                                    </Link>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Inner pages: search input (desktop, fills the middle — 1px #2c2c2c pill) ── */}
                {!isHome && (
                    <form
                        onSubmit={submitSearch}
                        role='search'
                        className='hidden md:flex flex-1 items-center gap-2 max-w-141.25 rounded-it-full border border-[rgba(44,44,44,0.20)] px-4 py-3 bg-it-white'>
                        <button
                            type='submit'
                            aria-label={dict.search}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-text-muted'>
                            <SearchIcon className='size-4.5 shrink-0' />
                        </button>
                        <input
                            type='search'
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={dict.search}
                            aria-label={dict.search}
                            className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                        />
                    </form>
                )}

                {/* ── Desktop right: Language + Wishlist + Account ── */}
                <div className='hidden md:flex items-center gap-6 shrink-0'>
                    {/* Language switcher */}
                    <div ref={langRef} className='relative'>
                        <button
                            onClick={() => {
                                setIslandOpen(false);
                                setCatOpen(false);
                                setLangOpen(v => !v);
                            }}
                            aria-label={dict.language}
                            aria-expanded={langOpen}
                            className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                            <Flag code={locale} />
                            <span className='text-base font-medium text-it-ink uppercase'>
                                {locale}
                            </span>
                        </button>

                        <AnimatePresence>
                            {langOpen && (
                                <motion.ul
                                    {...dropdownMotion}
                                    className='absolute top-[calc(100%+18px)] right-0 m-0 p-0 list-none min-w-45 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {localeOptions}
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
                        <Image
                            src='/icons/nav-profile.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </Link>
                </div>

                {/* ── Mobile right: Search (inner) + Language + Account + Menu ── */}
                <div className='flex md:hidden items-center gap-5'>
                    {!isHome && (
                        <button
                            type='button'
                            onClick={() => {
                                setMobileOpen(false);
                                setLangOpen(false);
                                setMobileSearchOpen(true);
                            }}
                            aria-label={dict.search}
                            aria-expanded={mobileSearchOpen}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-heading'>
                            <SearchIcon className='size-6' />
                        </button>
                    )}

                    {/* Language */}
                    <div ref={mobileLangRef} className='relative'>
                        <button
                            onClick={() => setLangOpen(v => !v)}
                            aria-label={dict.language}
                            aria-expanded={langOpen}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                            <Flag code={locale} />
                        </button>

                        <AnimatePresence>
                            {langOpen && (
                                <motion.ul
                                    {...dropdownMotion}
                                    className='absolute top-[calc(100%+18px)] right-0 m-0 p-0 list-none min-w-48 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {localeOptions}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Account */}
                    <Link
                        href='/login'
                        aria-label={dict.account}
                        className='flex items-center no-underline'>
                        <Image
                            src='/icons/nav-profile.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </Link>

                    {/* Menu toggle */}
                    <motion.button
                        className='bg-transparent border-none cursor-pointer p-0 text-it-ink'
                        whileTap={{ scale: 0.85 }}
                        transition={springFast}
                        aria-label={mobileOpen ? dict.close : dict.menu}
                        onClick={() => {
                            setLangOpen(false);
                            setMobileOpen(v => !v);
                        }}>
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.span
                                key={mobileOpen ? 'close' : 'open'}
                                className='inline-flex'
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.18 }}>
                                {mobileOpen ? (
                                    <X size={24} strokeWidth={1.5} />
                                ) : (
                                    <Menu size={24} strokeWidth={1.5} />
                                )}
                            </motion.span>
                        </AnimatePresence>
                    </motion.button>
                </div>
            </div>

            {/* ── Mobile search — expands over the bar when the search icon is tapped ── */}
            <AnimatePresence>
                {mobileSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className='absolute inset-0 z-50 flex items-center gap-3 bg-it-white px-4 md:hidden'>
                        <button
                            type='button'
                            onClick={() => setMobileSearchOpen(false)}
                            aria-label={dict.close}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-heading'>
                            <ArrowLeft size={24} strokeWidth={1.5} />
                        </button>
                        <form
                            onSubmit={submitSearch}
                            role='search'
                            className='flex flex-1 items-center gap-2 rounded-it-full border border-it-heading px-4 py-2.5 bg-it-white'>
                            <input
                                ref={mobileSearchInputRef}
                                type='search'
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={dict.search}
                                aria-label={dict.search}
                                className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                            />
                            <button
                                type='submit'
                                aria-label={dict.search}
                                className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-text-muted'>
                                <SearchIcon className='size-4.5 shrink-0' />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Mobile menu (islands + categories + wishlist) ── */}
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
                        className='absolute top-18 left-0 right-0 overflow-hidden bg-it-white border-b border-it-border z-50 md:hidden'>
                        <div className='border-t border-it-border px-4 py-6 flex flex-col gap-1'>
                            <span className='px-1 pb-1 text-xs font-medium  text-it-ink-muted'>
                                {dict.selectIsland}
                            </span>
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
                                        href={localizeHref(
                                            locale,
                                            `/${island.slug}`
                                        )}
                                        onClick={() => setMobileOpen(false)}
                                        aria-current={
                                            island.slug === currentIsland?.slug
                                        }
                                        className={`block text-base no-underline py-2 ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                        {island.name}
                                    </Link>
                                </motion.div>
                            ))}

                            {!isHome && (
                                <>
                                    <div className='my-3 h-px bg-it-border' />
                                    <span className='px-1 pb-1 text-xs font-medium uppercase tracking-wide text-it-ink-muted'>
                                        {dict.categories}
                                    </span>
                                    {categories.map((cat, i) => (
                                        <motion.div
                                            key={cat.slug}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                delay: 0.1 + i * 0.05,
                                                duration: 0.25,
                                            }}>
                                            <Link
                                                href={categoryHref(cat.slug)}
                                                onClick={() =>
                                                    setMobileOpen(false)
                                                }
                                                className='block text-it-ink text-base no-underline py-2'>
                                                {cat.name}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </>
                            )}

                            <div className='my-3 h-px bg-it-border' />

                            <button
                                aria-label={dict.wishlist}
                                className='flex items-center gap-2.5 bg-transparent border-none cursor-pointer p-0 py-2 text-it-ink'>
                                <Image
                                    src='/icons/nav-heart.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                                <span className='text-base'>
                                    {dict.wishlist}
                                </span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}


