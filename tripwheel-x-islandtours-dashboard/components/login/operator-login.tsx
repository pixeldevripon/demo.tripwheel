'use client';

import { MountReveal } from '@/components/mount-reveal';
import Link from 'next/link';
import { quietLink } from './login-ui';
import AuthForm from './auth-form';
// import OperatorTwoFactor from './operator-two-factor'; // 2FA — uncomment when enabled

/**
 * Operator portal login card (`/portal`) — credential step.
 * Rendered inside the portal shell (`app/(login)/portal/layout.tsx`), which
 * owns the brand panel, so this component is only the right-hand card.
 *
 * 2FA (TOTP / backup codes) is wired in `operator-two-factor.tsx` but
 * commented out below — uncomment when the backend supports it.
 */

// 2FA types — kept for when the flow is re-enabled
export type Channel = 'totp' | 'wa' | 'backup';

export const CODE_ERRORS: Record<Channel, string> = {
    totp: "That code didn't work. Your app makes a new one every 30 seconds, try the newest.",
    wa: "That code didn't work. WhatsApp codes are valid for 10 minutes.",
    backup: "That backup code didn't work. Each one works once.",
};

export const CHANNEL_SUBS: Record<Channel, string> = {
    totp: 'The 6-digit code from your authenticator app.',
    wa: 'Code sent to the WhatsApp number ending in 43.',
    backup: 'Enter one of your backup codes.',
};

export function OperatorLogin() {
    // ── 2FA state — uncomment when 2FA is enabled ──────────────────────────
    // const [step, setStep] = useState<1 | 2>(1);
    // const [channel, setChannel] = useState<Channel>('totp');
    // const [code, setCode] = useState('');
    // const [codeError, setCodeError] = useState(false);
    //
    // function switchChannel(next: Channel) {
    //     setChannel(next);
    //     setCode('');
    //     setCodeError(false);
    // }
    // function backToCredentials() {
    //     setStep(1);
    //     setChannel('totp');
    //     setCode('');
    //     setCodeError(false);
    // }
    // function verify(e: React.FormEvent<HTMLFormElement>) {
    //     e.preventDefault();
    //     const raw = code.trim();
    //     const ok =
    //         channel === 'backup'
    //             ? raw.replace(/[^A-Za-z0-9]/g, '').length >= 8
    //             : raw.replace(/\D/g, '').length >= 6;
    //     if (!ok) { setCodeError(true); return; }
    //     setCodeError(false);
    //     router.push('/');
    //     router.refresh();
    // }
    // ──────────────────────────────────────────────────────────────────────

    const cardClass =
        'w-full rounded-[16px] border border-it-border bg-it-white px-8 pb-6 pt-8 shadow-it-md';

    return (
        <MountReveal className={cardClass}>
            <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                Operator portal
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>
                Manage your tours, availability, and bookings.
            </p>

            <AuthForm />

{/*             <div className='mt-4 flex flex-col items-center gap-2.5'>
                <Link href='/apply' className={quietLink}>
                    New here? Apply to list your tours &rarr;
                </Link>
                <Link href='/bookings' className={quietLink}>
                    Looking for your booking? Go to island.tours/bookings &rarr;
                </Link>
            </div> */}

            {/*
             * ── 2FA step — uncomment block + setStep(2) call above when enabled ──
             * {step === 2 && !loggedIn && (
             *     <OperatorTwoFactor
             *         backToCredentials={backToCredentials}
             *         switchChannel={switchChannel}
             *         verify={verify}
             *         channel={channel}
             *         code={code}
             *         codeError={codeError}
             *         setChannel={setChannel}
             *         setCode={setCode}
             *     />
             * )}
             */}
        </MountReveal>
    );
}

