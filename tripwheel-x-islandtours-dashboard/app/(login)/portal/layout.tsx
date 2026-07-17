'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { SecurityCheckIcon } from '@hugeicons/core-free-icons';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MountReveal } from '@/components/mount-reveal';

/**
 * Operator portal shell (`/portal/*`). The split-screen brand panel is part of
 * the LAYOUT, so it persists across `/portal`, `/portal/forgot`, and
 * `/portal/reset` - navigating only swaps the card on the right ("replacing the
 * login portion"). The card is wrapped in a `MountReveal` keyed by pathname:
 * an enter-only motion.div that re-animates on each navigation (the safe App
 * Router transition pattern - no AnimatePresence around `children`).
 */
export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className='grid min-h-screen grid-cols-1 md:grid-cols-2'>
            {/* ── Brand panel (desktop only, persists across portal pages) ─── */}
            <aside className='relative hidden flex-col justify-between overflow-hidden bg-linear-155 from-brand-500 via-brand-700 via-55% to-brand-800 px-12 py-8 text-white md:flex'>
                <div className='relative z-10'>
                    <Image
                        src='/logo/footer-logo.png'
                        alt='Island Tours'
                        width={176}
                        height={131}
                        className='h-auto w-28 object-contain'
                    />
                    <div className='mt-2.5 text-2xs font-bold tracking-[0.12em] opacity-75'>
                        Operator portal
                    </div>
                </div>
                <div className='relative z-10'>
                    <h2 className='max-w-95 font-it-display text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-white!'>
                        Your tours, availability, and bookings. One place, every day.
                    </h2>
                    <p className='mt-2.5 max-w-90 text-sm opacity-85'>
                        Close a date in one tap, keep your content current, and see every booking the
                        moment it lands.
                    </p>
                </div>
                <div className='relative z-10 flex max-w-105 items-start gap-2 rounded-[12px] border border-white/20 bg-white/10 px-3 py-3 text-sm'>
                    <HugeiconsIcon icon={SecurityCheckIcon} className='mt-0.5 size-4.25 shrink-0' strokeWidth={1.5} />
                    <span>
                        We&apos;ll never ask for your password or codes by email, text, or phone.
                    </span>
                </div>
            </aside>

            {/* ── Form side: the card swaps per route, brand panel stays ────── */}
            <main className='flex flex-col items-center justify-center bg-it-bg px-6 py-12'>
                <MountReveal key={pathname} className='w-full max-w-100'>
                    {children}
                </MountReveal>

                {/* Anti-phishing line, mobile (brand panel hidden) */}
                <p className='mt-4 block w-full max-w-100 rounded-[12px] border border-info-border bg-info-subtle px-3 py-3 text-xs text-info-fg md:hidden'>
                    We&apos;ll never ask for your password or codes by email, text, or phone.
                </p>
            </main>
        </div>
    );
}
