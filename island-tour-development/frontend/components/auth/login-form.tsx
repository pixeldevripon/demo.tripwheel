'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        try {
            await signIn.social({
                provider: 'google',
                callbackURL: `${window.location.origin}/dashboard`,
            });
        } catch (err: any) {
            setError(err?.message || 'Failed to sign in with Google');
            setIsGoogleLoading(false);
        }
    };

    return (
        <Card className='w-full max-w-md mx-auto'>
            <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                    Enter your email and password to access your account.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <FieldGroup>
                        <Field data-invalid={!!error}>
                            <FieldLabel htmlFor='email'>Email</FieldLabel>
                            <Input
                                id='email'
                                type='email'
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder='name@example.com'
                                required
                                aria-invalid={!!error}
                            />
                        </Field>

                        <Field data-invalid={!!error}>
                            <div className='flex items-center justify-between'>
                                <FieldLabel htmlFor='password'>
                                    Password
                                </FieldLabel>
                                <a
                                    href='/forgot-password'
                                    className='text-xs text-muted-foreground underline hover:text-primary'>
                                    Forgot password?
                                </a>
                            </div>
                            <Input
                                id='password'
                                type='password'
                                value={password}
                                placeholder='Password'
                                onChange={e => setPassword(e.target.value)}
                                required
                                aria-invalid={!!error}
                            />
                            {error && <FieldError>{error}</FieldError>}
                        </Field>
                    </FieldGroup>
                </CardContent>
                <CardFooter className='flex flex-col gap-4 mt-4'>
                    <Button
                        type='submit'
                        className='w-full'
                        disabled={loading || isGoogleLoading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </Button>

                    <div className='relative w-full text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border'>
                        <span className='relative z-10 bg-card px-2 text-muted-foreground'>
                            Or continue with
                        </span>
                    </div>

                    <Button
                        type='button'
                        variant='outline'
                        className='w-full'
                        onClick={handleGoogleSignIn}
                        disabled={loading || isGoogleLoading}>
                        {isGoogleLoading
                            ? 'Connecting...'
                            : 'Sign in with Google'}
                    </Button>

                    <div className='text-sm text-center text-muted-foreground mt-2'>
                        Don&apos;t have an account?{' '}
                        <a
                            href='/signup'
                            className='underline hover:text-primary'>
                            Sign up
                        </a>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}

