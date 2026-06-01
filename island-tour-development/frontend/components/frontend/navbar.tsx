'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const islands = ['Curaçao', 'Aruba', 'Sint Maarten', 'Saint Lucia', 'Bonaire'];

// Shared spring for icon press/hover
const iconTap = {
    whileHover: { scale: 1.12 },
    whileTap: { scale: 0.9 },
} as const;
const springFast = { type: 'spring', stiffness: 400, damping: 17 } as const;

export function Navbar() {
    const [islandOpen, setIslandOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-20 bg-it-white border-b border-it-border'>
            <div className='it-container h-full flex items-center justify-between'>
                {/* ── Left: Logo + Island selector ── */}
                <div className='flex items-center gap-12'>
                    <Link href='/' className='shrink-0'>
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
                    <div className='relative hidden md:block'>
                        <button
                            onClick={() => setIslandOpen(!islandOpen)}
                            className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/nav-location.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className='text-base font-medium text-it-ink'>
                                Select your Island
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
                                    {islands.map(island => (
                                        <Link
                                            key={island}
                                            href={`/${island.toLowerCase().replace(/\s+/g, '-')}`}
                                            onClick={() => setIslandOpen(false)}
                                            className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                            {island}
                                        </Link>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── Right: Language + Wishlist + Account ── */}
                <div className='hidden md:flex items-center gap-6'>
                    <button className='flex items-center gap-1 bg-transparent border-none cursor-pointer p-0'>
                        <Image
                            src='/icons/nav-globe.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                        <span className='text-base font-medium text-it-ink'>
                            EN
                        </span>
                    </button>

                    <div className='w-px h-5 bg-it-border' />

                    <button className='flex items-center bg-transparent border-none cursor-pointer p-0'>
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
                        aria-label='Account'
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
                    onClick={() => setMobileOpen(!mobileOpen)}>
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
                                    key={island}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.06 + i * 0.05,
                                        duration: 0.25,
                                    }}>
                                    <Link
                                        href={`/${island.toLowerCase().replace(/\s+/g, '-')}`}
                                        onClick={() => setMobileOpen(false)}
                                        className='text-it-ink text-base no-underline py-1'>
                                        {island}
                                    </Link>
                                </motion.div>
                            ))}
                            <div className='h-px bg-it-border' />
                            <div className='flex items-center gap-6'>
                                <motion.button
                                    {...iconTap}
                                    transition={springFast}
                                    className='flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0'>
                                    <Image
                                        src='/icons/nav-globe.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5'
                                    />
                                    <span className='text-sm text-it-ink font-medium'>
                                        EN
                                    </span>
                                </motion.button>
                                <motion.button
                                    aria-label='Wishlist'
                                    {...iconTap}
                                    transition={springFast}
                                    className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                                    <Image
                                        src='/icons/nav-heart.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5'
                                    />
                                </motion.button>
                                <Link
                                    href='/login'
                                    aria-label='Account'
                                    className='flex items-center no-underline'>
                                    <motion.span
                                        className='inline-flex'
                                        {...iconTap}
                                        transition={springFast}>
                                        <Image
                                            src='/icons/nav-profile.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-5'
                                        />
                                    </motion.span>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}

