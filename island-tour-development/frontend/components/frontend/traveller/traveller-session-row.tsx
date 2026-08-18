'use client';

import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTravellerIdentity } from '@/hooks/use-traveller-identity';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { signOutTraveller } from '@/lib/traveler-booking';

import { maskEmail } from './traveller-format';

/**
 * "Signed in as {maskedEmail} · Log out" (review F4): the account surface must
 * say WHO it is showing and hand over a visible way out - the navbar dropdown
 * alone is not a session indicator. The email comes from the client identity
 * store (the same one the navbar renders from), masked because booking screens
 * get screenshotted and shared.
 */
export function TravellerSessionRow({
    dict,
    locale,
}: {
    dict: Dictionary['traveller'];
    locale: Locale;
}) {
    const { email } = useTravellerIdentity();
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    if (!email) return null;

    async function handleLogout() {
        if (busy) return;
        setBusy(true);
        // Awaits the HttpOnly session delete before leaving - the page behind
        // us is account-gated, so a race would flash the login card and back.
        await signOutTraveller();
        router.replace(localizeHref(locale, '/'));
        // `replace` alone leaves this page's RSC payload - every booking and
        // payment on the account - in the client router cache, readable by
        // pressing Back on a shared machine. `refresh()` is what evicts it.
        router.refresh();
    }

    return (
        <p className='m-0 flex items-center gap-1.5 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
            {dict.signedInAs.replace('{email}', maskEmail(email))}
            <span aria-hidden>·</span>
            <button
                type='button'
                onClick={() => void handleLogout()}
                disabled={busy}
                className='inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-medium text-it-heading transition-colors hover:text-it-primary disabled:opacity-60 tracking-[-0.012em]'>
                {busy ? (
                    <Loader2
                        className='size-3.5 animate-spin'
                        strokeWidth={2}
                    />
                ) : (
                    <LogOut className='size-3.5' strokeWidth={2} />
                )}
                {busy ? dict.loggingOut : dict.logout}
            </button>
        </p>
    );
}

