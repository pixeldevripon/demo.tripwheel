'use client';

import { MountReveal } from '@/components/mount-reveal';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

/**
 * Admin surface shell (`/admin/*`) - the system administrator door, merged in
 * from the standalone `tripwheel-app` deployment.
 *
 * Shares the staff surface's dark takeover rather than the operator portal's
 * split-screen (both are internal tools: calm, zero marketing), but is not the
 * same screen - its own eyebrow, its own hairline accent and its own footer
 * warning, so an admin never has to wonder which door they are standing at. The
 * shell persists across `/admin`, `/admin/forgot` and `/admin/reset`;
 * navigating only swaps the card, wrapped in a MountReveal keyed by pathname
 * (enter-only - the safe App Router transition pattern, no AnimatePresence
 * around `children`).
 */
export default function AdminLayout({
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
            <div className='mb-6 rounded-full border border-white/35 px-3 py-1 text-2xs font-medium uppercase tracking-caps text-white/80'>
                System administration
            </div>

            <div className='w-full max-w-95'>
                <MountReveal key={pathname}>{children}</MountReveal>
            </div>

            <p className='mt-6 max-w-85 text-center text-xs leading-[1.6] text-white/55'>
                Authorised administrators only. Every sign-in and action is
                logged and attributed.
            </p>
        </div>
    );
}
