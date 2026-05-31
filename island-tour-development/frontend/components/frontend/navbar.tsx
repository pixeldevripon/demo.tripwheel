'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const islands = ['Curaçao', 'Aruba', 'Sint Maarten', 'Saint Lucia', 'Bonaire'];

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

                        {islandOpen && (
                            <div className='absolute top-[calc(100%+12px)] left-0 min-w-45 bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                {islands.map(island => (
                                    <Link
                                        key={island}
                                        href={`/${island.toLowerCase().replace(/\s+/g, '-')}`}
                                        onClick={() => setIslandOpen(false)}
                                        className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                        {island}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Language + Wishlist + Account ── */}
                <div className='hidden md:flex items-center gap-6'>
                    <button className='flex items-center gap-1 bg-transparent border-none cursor-pointer p-0'>
                        <Image src='/icons/nav-globe.svg' alt='' width={24} height={24} className='size-6' />
                        <span className='text-base font-medium text-it-ink'>EN</span>
                    </button>

                    <div className='w-px h-5 bg-it-border' />

                    <button
                        aria-label='Wishlist'
                        className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                        <Image src='/icons/nav-heart.svg' alt='' width={24} height={24} className='size-6' />
                    </button>

                    <div className='w-px h-5 bg-it-border' />

                    <Link href='/login' aria-label='Account' className='flex items-center no-underline'>
                        <Image src='/icons/nav-profile.svg' alt='' width={24} height={24} className='size-6' />
                    </Link>
                </div>

                {/* ── Mobile toggle ── */}
                <button
                    className='md:hidden bg-transparent border-none cursor-pointer p-1 text-it-ink'
                    onClick={() => setMobileOpen(!mobileOpen)}>
                    {mobileOpen ? (
                        <X size={22} strokeWidth={1.5} />
                    ) : (
                        <Menu size={22} strokeWidth={1.5} />
                    )}
                </button>
            </div>

            {/* ── Mobile menu ── */}
            {mobileOpen && (
                <div className='absolute top-20 left-0 right-0 bg-it-white border-t border-b border-it-border px-6 py-6 flex flex-col gap-4 z-50'>
                    {islands.map(island => (
                        <Link
                            key={island}
                            href={`/${island.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => setMobileOpen(false)}
                            className='text-it-ink text-base no-underline py-1'>
                            {island}
                        </Link>
                    ))}
                    <div className='h-px bg-it-border' />
                    <div className='flex items-center gap-6'>
                        <button className='flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0'>
                            <Image src='/icons/nav-globe.svg' alt='' width={20} height={20} className='size-5' />
                            <span className='text-sm text-it-ink font-medium'>EN</span>
                        </button>
                        <button
                            aria-label='Wishlist'
                            className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                            <Image src='/icons/nav-heart.svg' alt='' width={20} height={20} className='size-5' />
                        </button>
                        <Link href='/login' aria-label='Account' className='flex items-center no-underline'>
                            <Image src='/icons/nav-profile.svg' alt='' width={20} height={20} className='size-5' />
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
