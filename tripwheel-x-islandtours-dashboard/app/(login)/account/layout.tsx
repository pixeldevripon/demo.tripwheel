'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { SecurityCheckIcon } from '@hugeicons/core-free-icons';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MountReveal } from '@/components/mount-reveal';

/**
 * Customer account shell (`/account/*`) - the traveler door of the dashboard
 * app (fourth door; operators use /portal, staff /staff). Mirrors the portal's
 * split-screen layout with traveler copy: the brand panel persists across
 * `/account`, `/account/forgot`, and `/account/reset`; navigating only swaps
 * the card, wrapped in a MountReveal keyed by pathname (enter-only - the safe
 * App Router transition pattern).
 */
export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className='grid min-h-screen grid-cols-1 md:grid-cols-2'>
            {/* ── Brand panel (desktop only, persists across account pages) ── */}
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
                        Your account
                    </div>
                </div>
                <div className='relative z-10'>
                    <h2 className='max-w-95 font-it-display text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-white!'>
                        All your island adventures, in one place.
                    </h2>
                    <p className='mt-2.5 max-w-90 text-sm opacity-85'>
                        See every booking and payment, download receipts, and
                        manage your details - any time, from any device.
                    </p>
                </div>
                <div className='relative z-10 flex max-w-105 items-start gap-2 rounded-[12px] border border-white/20 bg-white/10 px-3 py-3 text-sm'>
                    <HugeiconsIcon
                        icon={SecurityCheckIcon}
                        className='mt-0.5 size-4.25 shrink-0'
                        strokeWidth={1.5}
                    />
                    <span>
                        We&apos;ll never ask for your password or codes by
                        email, text, or phone.
                    </span>
                </div>
            </aside>

            {/* ── Form side: the card swaps per route, brand panel stays ───── */}
            <main className='flex flex-col items-center justify-center bg-it-bg px-6 py-12'>
                <MountReveal key={pathname} className='w-full max-w-100'>
                    {children}
                </MountReveal>

                {/* Anti-phishing line, mobile (brand panel hidden) */}
                <p className='mt-4 block w-full max-w-100 rounded-[12px] border border-info-border bg-info-subtle px-3 py-3 text-xs text-info-fg md:hidden'>
                    We&apos;ll never ask for your password or codes by email,
                    text, or phone.
                </p>
            </main>
        </div>
    );
}
