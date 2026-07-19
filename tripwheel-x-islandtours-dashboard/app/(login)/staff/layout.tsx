'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MountReveal } from '@/components/mount-reveal';

/**
 * Staff surface shell (`/staff/*`) - deliberately NOT the operator portal's
 * split-screen: a dark, near-monochrome takeover (spec 4: internal tool, calm,
 * zero marketing) that persists across `/staff`, `/staff/forgot` and
 * `/staff/reset`; navigating only swaps the card. The card is wrapped in a
 * MountReveal keyed by pathname (enter-only - the safe App Router transition
 * pattern, no AnimatePresence around `children`).
 */
export default function StaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className='flex min-h-screen flex-col items-center justify-center bg-it-ink px-6 py-12'>
            <Image
                src='/logo/footer-logo.png'
                alt='Island Tours'
                width={176}
                height={131}
                priority
                className='mb-4 h-auto w-28 object-contain'
            />
            <div className='mb-6 rounded-full border border-white/20 px-3 py-1 text-2xs font-bold uppercase tracking-caps text-white/70'>
                Staff access
            </div>

            <div className='w-full max-w-95'>
                <MountReveal key={pathname}>{children}</MountReveal>
            </div>

            <p className='mt-6 max-w-85 text-center text-xs leading-[1.6] text-white/55'>
                Island Tours staff only. Every sign-in and action is logged.
            </p>
        </div>
    );
}
