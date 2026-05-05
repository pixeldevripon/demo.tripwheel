import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkOnboardingStatus } from '../_actions/onboardingActions';

export const metadata = {
    title: 'Onboarding | Island Tours',
    description: 'Complete your tour operator profile to get started.',
};

export default async function OnboardingPage() {
    const reqHeaders = await headers();
    const { data: sessionData } = await authClient.getSession({
        fetchOptions: { headers: reqHeaders },
    });

    if (!sessionData?.session) {
        redirect('/login');
    }

    const { user } = sessionData;
    const userRole = (user as any).role;

    if (userRole !== 'TOUR_OPERATOR') {
        redirect('/dashboard');
    }

    const { needsOnboarding } = await checkOnboardingStatus();
    if (!needsOnboarding) {
        redirect('/dashboard');
    }

    return (
        <div className='min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8'>
            <div className='w-full max-w-3xl space-y-8 relative z-10'>
                <div className='text-center space-y-3'>
                    <h1 className='text-4xl  font-bold tracking-tight text-white'>
                        Welcome to Island Tours
                    </h1>
                    <p className='text-slate-400 text-lg'>
                        Let's get your operator profile set up.
                    </p>
                </div>

                <OnboardingForm />
            </div>
        </div>
    );
}

