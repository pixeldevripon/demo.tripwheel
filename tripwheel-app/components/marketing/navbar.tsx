'use client';

import { Cancel01Icon, Menu01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';


/**
 * Dark sticky navbar (Clarasight ref): logo left, anchor links centre,
 * Log in / Contact sales / Start free on the right.
 */
export function MarketingNavbar() {
    const [open, setOpen] = useState(false);

    return (
        <header className='sticky top-0 z-50 border-b border-mk-nav-line bg-mk-nav'>
            <nav className='mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 md:px-8'>
                <Link
                    href='#home'
                    className='flex shrink-0 items-center'
                    onClick={() => setOpen(false)}>
                    <Image
                        src='/logo/logo-dark.svg'
                        alt='TripWheel'
                        width={109}
                        height={14}
                        priority
                    />
                </Link>

                <div className='hidden items-center gap-6 lg:flex'>
                    <Link
                        href='/login'
                        className='text-sm text-mk-nav-fg transition-colors hover:text-white'>
                        Log in
                    </Link>
                    <a
                        href='#contact'
                        className='text-sm text-mk-nav-fg transition-colors hover:text-white'>
                        Contact sales
                    </a>
                    <Link
                        href='/login'
                        className='inline-flex h-9 items-center rounded-full bg-mk-accent px-4 text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover'>
                        Start free
                    </Link>
                </div>

                <button
                    type='button'
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    aria-expanded={open}
                    onClick={() => setOpen(value => !value)}
                    className='inline-flex size-9 items-center justify-center rounded-md text-white lg:hidden'>
                    <HugeiconsIcon
                        icon={open ? Cancel01Icon : Menu01Icon}
                        className='size-5'
                    />
                </button>
            </nav>

            {open && (
                <div className='border-t border-mk-nav-line bg-mk-nav px-6 pt-2 pb-6 lg:hidden'>
                    <div className='flex flex-col'>
                        <Link
                            href='/login'
                            onClick={() => setOpen(false)}
                            className='border-b border-mk-nav-line py-3 text-sm text-mk-nav-fg transition-colors hover:text-white'>
                            Log in
                        </Link>
                        <a
                            href='#contact'
                            onClick={() => setOpen(false)}
                            className='border-b border-mk-nav-line py-3 text-sm text-mk-nav-fg transition-colors hover:text-white'>
                            Contact sales
                        </a>
                        <Link
                            href='/login'
                            onClick={() => setOpen(false)}
                            className='mt-4 inline-flex h-11 items-center justify-center rounded-full bg-mk-accent px-6 text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover'>
                            Start free
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}

