'use client';

import { loginPrecheck } from '@/lib/api/auth';
import { authClient, getSessionRole, signIn } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { adminBtn, ErrorNote, Field, inputClass, quietLink } from './login-ui';

/**
 * Generic rejection for every non-success outcome on this door.
 *
 * This is the SYSTEM ADMIN login, and it deliberately never hints at the other
 * surfaces the way `/portal` and `/staff` do: real admins know where they are,
 * and anyone else must not be told where to try next. One string for a wrong
 * password, a non-admin account, and a wrong-door rejection alike - a distinct
 * "invalid password" message would tell an attacker which emails are real admin
 * accounts, which is exactly what this door exists to withhold.
 *
 * This is why the door does NOT reuse `AuthForm`: that component renders
 * `WrongDoorNote`, which names the correct surface. Correct for the operator and
 * staff doors, wrong here - and keeping the logic separate means a later edit to
 * the shared form cannot quietly reintroduce the hint.
 */
const GENERIC_REJECTION = "These credentials can't be used to sign in here.";

/**
 * Admin sign-in card (`/admin`). Rendered inside the admin shell
 * (app/(login)/admin/layout.tsx).
 *
 * Email + password against the same Better Auth backend as every other door,
 * with `x-login-surface: admin` so the backend enforces the surface server-side.
 * Authorization is always the backend's decision - the separate URL, styling and
 * copy are surface separation, not a security control.
 *
 * Merged in from the standalone `tripwheel-app` deployment, which used to own
 * this door on its own origin. The only behavioural change is the hand-off: a
 * successful sign-in is now an in-app navigation rather than a cross-origin
 * redirect, because the dashboard it hands over to is this same application.
 */
export function AdminLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Advisory pre-check (fails open): saves a wasted password round
            // trip for non-admin accounts. Unlike the other doors we ignore the
            // `suggested` surface it returns and answer with the generic string
            // - the hint is the thing we are withholding here.
            const precheck = await loginPrecheck(email, 'admin');
            if (!precheck.ok) {
                setError(GENERIC_REJECTION);
                return;
            }

            const { data, error: authError } = await signIn.email(
                { email, password },
                { headers: { 'x-login-surface': 'admin' } }
            );

            if (authError) {
                setError(GENERIC_REJECTION);
                return;
            }
            if (!data) {
                // Neither data nor error: better-fetch resolves this way on a
                // network/CORS failure, and it is not a credential problem, so
                // it gets its own actionable message.
                setError(
                    'Could not reach the authentication server. Please try again.'
                );
                return;
            }

            // Defence in depth: the backend's surface enforcement should make a
            // non-admin session impossible here, but verify against the
            // authoritative session before handing over.
            const role = await getSessionRole();
            if (role !== 'ADMIN') {
                // Drop the just-minted session; retry once on a hiccup. Even if
                // both attempts fail, every dashboard request re-derives the
                // role server-side, so a lingering non-admin cookie grants
                // nothing extra.
                const out = await authClient
                    .signOut()
                    .catch(() => ({ error: { message: 'network' } }));
                if (out && 'error' in out && out.error) {
                    await authClient.signOut().catch(() => undefined);
                }
                setError(GENERIC_REJECTION);
                return;
            }

            router.push('/');
            router.refresh();
        } catch {
            // Never render a raw exception on this door - it could carry
            // backend detail. One fixed string for the unexpected path.
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='w-full rounded-[16px] bg-it-white px-8 pb-6 pt-8 shadow-2xl shadow-black/40'>
            <h1 className='m-0 font-it-display text-xl font-medium text-it-heading'>
                Sign in
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>
                System administrator access.
            </p>

            <form onSubmit={handleSubmit}>
                <Field label='Email' htmlFor='a-email'>
                    <input
                        id='a-email'
                        aria-label='Email'
                        type='email'
                        name='email'
                        autoComplete='username'
                        inputMode='email'
                        placeholder='you@islandtours.com'
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className={inputClass}
                    />
                </Field>

                <Field label='Password' htmlFor='a-pw'>
                    <div className='relative'>
                        <input
                            id='a-pw'
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
                            className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                            {showPw ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </Field>

                <div className='mb-4 mt-0.5 flex items-center justify-end'>
                    <Link href='/admin/forgot' className={quietLink}>
                        Forgot your password?
                    </Link>
                </div>

                {/* No WrongDoorNote here, on purpose - see GENERIC_REJECTION. */}
                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${adminBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <p className='mt-4 text-xs leading-[1.5] text-it-text-muted'>
                We&apos;ll never ask for your password by email, text, or phone.
            </p>
        </div>
    );
}
