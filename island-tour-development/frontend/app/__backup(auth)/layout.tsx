'use client';

import { AuthShell } from '@/components/__backup_auth/auth-shell';
import { Reveal } from '@/components/frontend/reveal';
import { usePathname } from 'next/navigation';

// Auth routes are not locale-prefixed (/login, /forgot-password, /reset-password).
const HEADINGS: Record<string, string> = {
    '/login': 'Welcome',
    '/forgot-password': 'Recover',
    '/reset-password': 'Reset',
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const heading = HEADINGS[pathname] ?? 'Welcome';

    return (
        <AuthShell heading={heading}>
            {/* Keyed by pathname: on navigation the old form unmounts and the new
                one replays Reveal's fade + lift. Enter-only (no AnimatePresence
                exit), so it doubles as the smooth page-to-page transition. */}
            <Reveal key={pathname} yOffset={24} delay={0.05} duration={0.5}>
                {children}
            </Reveal>
        </AuthShell>
    );
}
