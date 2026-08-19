'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

interface SetupGuideProps {
    loggedInUser: any;
}

export const SetupGuide = ({ loggedInUser }: SetupGuideProps) => {
    const setupSteps = [
        {
            number: 1,
            title: 'Create a Tour',
            description:
                'Build your first tour package with itinerary, dates, pricing, and other details.',
            buttonText: 'Create a Tour',
            linkTo: `/trips/new`,
        },
        {
            number: 2,
            title: 'Customize Your Website',
            description:
                'Tailor your site to match your brand and attract more customers.',
            buttonText: 'Website Settings',
            linkTo: `/settings?tab=site`,
        },
        {
            number: 3,
            title: 'Set Up Payment',
            description:
                'Enable secure payments to start accepting bookings online.',
            buttonText: 'Set Up Payment',
            linkTo: `/settings?tab=payments`,
        },
    ];

    return (
        <div className='w-full'>
            <div className='mb-6'>
                <h1 className='text-lg font-medium text-foreground mb-2'>
                    Welcome
                    {loggedInUser?.name ? ` ${loggedInUser.name}` : ''}, your
                    new site is almost ready
                </h1>
                <p className='text-sm text-muted-foreground'>
                    Follow these quick steps to configure your site.
                </p>
            </div>

            <Card>
                <CardHeader className='border-b mb-6'>
                    <CardTitle className='text-sm'>SETUP GUIDE</CardTitle>
                    <CardDescription>
                        Complete these steps to get your site up and running
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div className='space-y-6'>
                        {setupSteps.map((step, index) => (
                            <div
                                key={step.number}
                                className='flex items-start gap-4'>
                                {/* Step Number with Connector */}
                                <div className='shrink-0 flex flex-col items-center'>
                                    <div className='w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary border border-primary/20'>
                                        {step.number}
                                    </div>
                                    {index < setupSteps.length - 1 && (
                                        <div className='w-px h-10 bg-border mt-2' />
                                    )}
                                </div>

                                {/* Step Content */}
                                <div className='flex-1 min-w-0 pt-0.5'>
                                    <h3 className='font-medium text-foreground mb-1.5 leading-none'>
                                        {step.title}
                                    </h3>
                                    <p className='text-sm text-muted-foreground leading-relaxed'>
                                        {step.description}
                                    </p>
                                </div>

                                {/* Action Button */}
                                <div className='shrink-0'>
                                    <Link
                                        href={step.linkTo}
                                        className='gap-2 flex items-center border p-[6px] px-3 text-sm rounded-full hover:bg-secondary transform transition-colors duration-200'>
                                        {step.buttonText}
                                        <HugeiconsIcon
                                            icon={ArrowRight01Icon}
                                            className='w-4 h-4'
                                        />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

