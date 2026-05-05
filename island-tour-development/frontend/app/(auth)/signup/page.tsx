import { SignupForm } from '@/components/auth/signup-form';
import { SignupFormSkeleton } from '@/components/skelitons/signup-form-skeleton';
import { Suspense } from 'react';

export const metadata = {
    title: 'Sign Up - Island Tours',
    description: 'Create a new account',
};

export default function SignupPage() {
    return (
        <div className='flex min-h-screen flex-col items-center justify-center p-4'>
            <Suspense
                fallback={<SignupFormSkeleton />}>
                <SignupForm />
            </Suspense>
        </div>
    );
}

