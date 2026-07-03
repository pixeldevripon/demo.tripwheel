'use client';

import { signIn } from '@/lib/auth-client';
import { CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const emailLooksValid = /^\S+@\S+\.\S+$/.test(email);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error: authError } = await signIn.email({
                email,
                password,
            });

            if (authError) {
                setError(authError.message || 'Failed to sign in');
            } else {
                router.push('/dashboard');
                router.refresh();
            }
        } catch (err: any) {
            setError(err?.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className='mx-auto w-full max-w-sm'>
            <div className='space-y-5'>
                <div className='relative'>
                    <input
                        id='email'
                        type='email'
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder='name@example.com'
                        required
                        aria-invalid={!!error}
                        aria-label='Email'
                        className='h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-it-primary focus:ring-2 focus:ring-it-primary-subtle autofill:shadow-[inset_0_0_0_1000px_#ffffff] autofill:[-webkit-text-fill-color:#0f172a]'
                    />
                    {emailLooksValid && (
                        <span className='absolute top-1/2 right-4 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400 text-emerald-500'>
                            <CheckIcon className='size-3' strokeWidth={3} />
                        </span>
                    )}
                </div>

                <div className='relative'>
                    <label
                        htmlFor='password'
                        className='absolute -top-2 left-4 z-10 bg-white px-1.5 text-[11px] font-medium text-slate-500'>
                        Password
                    </label>
                    <input
                        id='password'
                        type='password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder='••••••••'
                        required
                        aria-invalid={!!error}
                        className='h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 pr-20 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-it-primary focus:ring-2 focus:ring-it-primary-subtle autofill:shadow-[inset_0_0_0_1000px_#ffffff] autofill:[-webkit-text-fill-color:#0f172a]'
                    />
                    <Link
                        href='/forgot-password'
                        className='absolute top-1/2 right-5 -translate-y-1/2 text-sm font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                        Forgot?
                    </Link>
                </div>

                {error && (
                    <p role='alert' className='text-sm text-red-500'>
                        {error}
                    </p>
                )}

                <button
                    type='submit'
                    disabled={loading}
                    className='h-13 w-full cursor-pointer rounded-full bg-it-primary text-sm font-bold tracking-wide text-it-primary-fg shadow-lg shadow-it-primary/25 transition-colors hover:bg-it-primary-hover disabled:cursor-not-allowed disabled:opacity-60'>
                    {loading ? 'Signing in...' : 'Log in'}
                </button>
            </div>
        </form>
    );
}

