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
import { authClient } from '@/lib/auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!token) {
        return (
            <Card className='w-full max-w-md mx-auto'>
                <CardHeader>
                    <CardTitle>Invalid reset link</CardTitle>
                    <CardDescription>
                        This password reset link is invalid or has expired.{' '}
                        <a
                            href='/forgot-password'
                            className='underline hover:text-primary'>
                            Request a new one.
                        </a>
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 12) {
            setError('Password must be at least 12 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        const { error: authError } = await authClient.resetPassword({
            newPassword: password,
            token,
        });

        setLoading(false);

        if (authError) {
            setError(
                authError.message ||
                    'Failed to reset password. The link may have expired.'
            );
        } else {
            // All existing sessions are revoked — redirect to login
            router.push('/login?reset=success');
        }
    };

    return (
        <Card className='w-full max-w-md mx-auto'>
            <CardHeader>
                <CardTitle>Set new password</CardTitle>
                <CardDescription>
                    Your new password must be at least 12 characters.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <FieldGroup>
                        <Field data-invalid={!!error}>
                            <FieldLabel htmlFor='password'>
                                New password
                            </FieldLabel>
                            <Input
                                id='password'
                                type='password'
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={12}
                                aria-invalid={!!error}
                            />
                        </Field>
                        <Field data-invalid={!!error}>
                            <FieldLabel htmlFor='confirm-password'>
                                Confirm new password
                            </FieldLabel>
                            <Input
                                id='confirm-password'
                                type='password'
                                value={confirmPassword}
                                onChange={e =>
                                    setConfirmPassword(e.target.value)
                                }
                                required
                                minLength={12}
                                aria-invalid={!!error}
                            />
                            {error && <FieldError>{error}</FieldError>}
                        </Field>
                    </FieldGroup>
                </CardContent>
                <CardFooter className='flex flex-col gap-4 mt-4'>
                    <Button type='submit' className='w-full' disabled={loading}>
                        {loading ? 'Saving...' : 'Reset password'}
                    </Button>
                    <div className='text-sm text-center text-muted-foreground'>
                        <a
                            href='/login'
                            className='underline hover:text-primary'>
                            Back to sign in
                        </a>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}

