import { loginPrecheck, type LoginSurface } from '@/lib/api/auth';
import { signIn } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
    quietLink,
    staffBtn,
    WrongDoorNote,
} from './login-ui';

interface AuthFormProps {
    /**
     * Which door renders the form. Same sign-in logic on every door; the
     * variant only pins the surface's own forgot route, button style and
     * placeholder so the doors never link into (or look like) each other.
     */
    variant?: 'portal' | 'staff';
}

const FORGOT_HREF: Record<'portal' | 'staff', string> = {
    portal: '/portal/forgot',
    staff: '/staff/forgot',
};

const ID_PREFIX: Record<'portal' | 'staff', string> = {
    portal: 'o',
    staff: 's',
};

const SUBMIT_CLASS: Record<'portal' | 'staff', string> = {
    portal: primaryBtn,
    staff: staffBtn,
};

/** Each dashboard door maps 1:1 onto its backend login surface. */
const SURFACE: Record<'portal' | 'staff', LoginSurface> = {
    portal: 'portal',
    staff: 'staff',
};

export default function AuthForm({ variant = 'portal' }: AuthFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [wrongDoor, setWrongDoor] = useState<LoginSurface | null>(null);
    const [loading, setLoading] = useState(false);

    const isStaff = variant === 'staff';
    const idPrefix = ID_PREFIX[variant];
    const forgotHref = FORGOT_HREF[variant];
    const submitClass = SUBMIT_CLASS[variant];
    const surface = SURFACE[variant];

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        setWrongDoor(null);
        try {
            // Friendly wrong-door check BEFORE the password leaves the form.
            // Fails open - the sign-in call below independently enforces the
            // surface server-side, so skipping this cannot bypass the door.
            const precheck = await loginPrecheck(email, surface);
            if (!precheck.ok) {
                setWrongDoor(precheck.suggested ?? 'portal');
                return;
            }

            const { error: authError } = await signIn.email(
                { email, password },
                { headers: { 'x-login-surface': surface } },
            );
            if (authError) {
                // Belt-and-braces: a wrong-door rejection can still come from
                // the server (e.g. the pre-check failed open). The backend
                // only reveals it after the password verified. If the retry
                // can't CONFIRM which door is right (it fails open), show a
                // generic note - never assert a specific door on no evidence.
                if (authError.code === 'WRONG_LOGIN_SURFACE') {
                    const retry = await loginPrecheck(email, surface);
                    if (!retry.ok && retry.suggested) {
                        setWrongDoor(retry.suggested);
                    } else {
                        setError(
                            'This account cannot sign in here. Please use the login page for your account type.',
                        );
                    }
                } else {
                    setError(authError.message || 'Invalid email or password.');
                }
            } else {
                // When 2FA is enabled: setStep(2) instead of redirect
                router.push('/');
                router.refresh();
            }
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : 'An unexpected error occurred.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }
    return (
        <form onSubmit={handleSubmit}>
            <Field label='Email' htmlFor={`${idPrefix}-email`}>
                <input
                    id={`${idPrefix}-email`}
                    aria-label='Email'
                    type='email'
                    name='email'
                    autoComplete='username'
                    inputMode='email'
                    placeholder={
                        isStaff
                            ? 'you@islandtours.com'
                            : 'you@yourcompany.com'
                    }
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={inputClass}
                />
            </Field>

            <Field label='Password' htmlFor={`${idPrefix}-pw`}>
                <div className='relative'>
                    <input
                        id={`${idPrefix}-pw`}
                        aria-label='Password'
                        type={showPw ? 'text' : 'password'}
                        name='password'
                        autoComplete='current-password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className={`${inputClass} pr-16`}
                    />
                    <button
                        type='button'
                        aria-live='polite'
                        onClick={() => setShowPw(v => !v)}
                        className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                        {showPw ? 'Hide' : 'Show'}
                    </button>
                </div>
            </Field>

            <div className='mb-4 mt-0.5 flex items-center justify-end'>
                <Link href={forgotHref} className={quietLink}>
                    Forgot your password?
                </Link>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}
            {wrongDoor && <WrongDoorNote correctSurface={wrongDoor} />}

            <button
                type='submit'
                disabled={loading}
                className={`${submitClass} disabled:cursor-not-allowed disabled:opacity-60`}>
                {loading ? 'Signing in…' : isStaff ? 'Sign in' : 'Log in'}
            </button>
        </form>
    );
}
