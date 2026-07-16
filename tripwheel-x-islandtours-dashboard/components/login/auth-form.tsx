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
} from './login-ui';

export default function AuthForm() {
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
            const { error: authError } = await signIn.email({
                email,
                password,
            });
            if (authError) {
                setError(authError.message || 'Invalid email or password.');
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
            <Field label='Email' htmlFor='o-email'>
                <input
                    id='o-email'
                    type='email'
                    name='email'
                    autoComplete='username'
                    inputMode='email'
                    placeholder='you@yourcompany.com'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={inputClass}
                />
            </Field>

            <Field label='Password' htmlFor='o-pw'>
                <div className='relative'>
                    <input
                        id='o-pw'
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
                        className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                        {showPw ? 'Hide' : 'Show'}
                    </button>
                </div>
            </Field>

            <div className='mb-4.5 mt-0.5 flex items-center justify-end'>
                <Link href='/portal/forgot' className={quietLink}>
                    Forgot your password?
                </Link>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button
                type='submit'
                disabled={loading}
                className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                {loading ? 'Signing in…' : 'Log in'}
            </button>
        </form>
    );
}

