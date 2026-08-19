'use client';

import { Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import { Reveal } from '@/components/marketing/reveal';

type Billing = 'monthly' | 'yearly';

interface Plan {
    name: string;
    /** Monthly price in USD; null = custom pricing. */
    monthly: number | null;
    /** Per-month price when billed yearly (~20% off); null = custom. */
    yearly: number | null;
    blurb: string;
    features: string[];
    cta: string;
    /** 'solid' = filled accent, 'outline' = hairline, 'dark' = black. */
    emphasis: 'solid' | 'outline' | 'dark';
    /** Disabled plans render their CTA inert (self-serve checkout ships later). */
    disabled: boolean;
}

const PLANS: Plan[] = [
    {
        name: 'Starter',
        monthly: 199,
        yearly: 159,
        blurb: 'Everything a growing agency needs to get off the ground.',
        features: [
            'Up to 3 team seats',
            'Bookings & itinerary management',
            'Customer CRM',
            'Basic reporting',
            'Email support',
        ],
        cta: 'Start with Starter',
        emphasis: 'outline',
        disabled: true,
    },
    {
        name: 'Growth',
        monthly: 299,
        yearly: 239,
        blurb: 'Automation and channels for agencies picking up speed.',
        features: [
            'Everything in Starter',
            'Up to 10 team seats',
            'Payments & invoicing',
            'Channel & OTA integrations',
            'Automated workflows',
            'Priority support',
        ],
        cta: 'Start with Growth',
        emphasis: 'solid',
        disabled: true,
    },
    {
        name: 'Scale',
        monthly: 399,
        yearly: 319,
        blurb: 'Advanced control for multi-branch travel operations.',
        features: [
            'Everything in Growth',
            'Unlimited seats',
            'Multi-branch management',
            'Advanced analytics & forecasting',
            'API access',
            'Dedicated onboarding',
        ],
        cta: 'Start with Scale',
        emphasis: 'outline',
        disabled: true,
    },
    {
        name: 'Enterprise',
        monthly: null,
        yearly: null,
        blurb: 'Dedicated infrastructure for the most demanding agencies.',
        features: [
            'Everything in Scale',
            'Volume pricing',
            'Dedicated infrastructure',
            'Custom roles & permissions',
            'SSO/SAML',
            '24/7 dedicated support',
        ],
        cta: 'Contact sales',
        emphasis: 'dark',
        disabled: false,
    },
];

/**
 * Pricing (Laravel Cloud ref): editorial headline + decorative UI collage on
 * top, then a hairline four-column plan grid. Monthly/yearly billing toggle;
 * self-serve CTAs are disabled until checkout ships - only Enterprise routes
 * to the contact form below.
 */
export function MarketingPricing() {
    const [billing, setBilling] = useState<Billing>('monthly');

    return (
        <section id='pricing' className='border-t border-mk-line bg-mk-paper'>
            <div className='px-6 pt-mk-half md:px-12'>
                <div className='grid items-center gap-12 lg:grid-cols-2'>
                    <Reveal>
                        <h2 className='text-mk-title font-medium text-mk-ink md:text-mk-display'>
                            A great experience
                            <br />
                            is priceless
                        </h2>
                        <p className='mt-6 max-w-md text-sm leading-relaxed text-mk-body md:text-base'>
                            Get started in minutes, and only pay for what your
                            agency needs. Upgrade for automation, more seats,
                            deeper integrations, and additional features.
                        </p>
                    </Reveal>

                    <Reveal delay={0.15} className='hidden lg:block'>
                        <PricingCollage />
                    </Reveal>
                </div>

                <Reveal delay={0.1} className='mt-12 flex justify-center'>
                    <BillingToggle billing={billing} onChange={setBilling} />
                </Reveal>
            </div>

            <Reveal
                delay={0.15}
                y={36}
                className='mt-8 border-t border-mk-line'>
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4'>
                    {PLANS.map((plan, index) => (
                        <PlanColumn
                            key={plan.name}
                            plan={plan}
                            billing={billing}
                            className={cn(
                                index > 0 &&
                                    'border-t border-mk-line md:border-t-0',
                                index % 2 === 1 && 'md:border-l md:border-mk-line',
                                index > 1 &&
                                    'md:border-t md:border-mk-line xl:border-t-0',
                                index > 0 && 'xl:border-l xl:border-mk-line'
                            )}
                        />
                    ))}
                </div>
            </Reveal>
        </section>
    );
}

function BillingToggle({
    billing,
    onChange,
}: {
    billing: Billing;
    onChange: (value: Billing) => void;
}) {
    return (
        <div
            role='group'
            aria-label='Billing period'
            className='relative grid w-72 grid-cols-2 rounded-full border border-mk-line-strong bg-mk-canvas p-1'>
            <span
                className={cn(
                    'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-mk-ink transition-transform duration-normal ease-out-quart',
                    billing === 'yearly' && 'translate-x-full'
                )}
                aria-hidden='true'
            />
            <button
                type='button'
                aria-pressed={billing === 'monthly'}
                onClick={() => onChange('monthly')}
                className={cn(
                    'relative z-10 h-9 rounded-full text-sm font-medium transition-colors',
                    billing === 'monthly' ? 'text-white' : 'text-mk-body'
                )}>
                Monthly
            </button>
            <button
                type='button'
                aria-pressed={billing === 'yearly'}
                onClick={() => onChange('yearly')}
                className={cn(
                    'relative z-10 h-9 rounded-full text-sm font-medium transition-colors',
                    billing === 'yearly' ? 'text-white' : 'text-mk-body'
                )}>
                Yearly
                <span
                    className={cn(
                        'ml-1.5 text-2xs font-semibold',
                        billing === 'yearly'
                            ? 'text-white'
                            : 'text-mk-accent-soft-fg'
                    )}>
                    -20%
                </span>
            </button>
        </div>
    );
}

function PlanColumn({
    plan,
    billing,
    className,
}: {
    plan: Plan;
    billing: Billing;
    className?: string;
}) {
    const price = billing === 'monthly' ? plan.monthly : plan.yearly;

    return (
        <div className={cn('flex flex-col px-8 py-8', className)}>
            <h3 className='text-mk-plan font-medium text-mk-ink'>
                {plan.name}
            </h3>

            <div className='mt-1 h-6 text-sm text-mk-body'>
                {price === null ? (
                    <span>Custom pricing</span>
                ) : (
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                            key={billing}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className='inline-flex items-baseline gap-1'>
                            <span className='font-semibold text-mk-ink'>
                                ${price}
                            </span>
                            <span>
                                per month
                                {billing === 'yearly' && ', billed yearly'}
                            </span>
                        </motion.span>
                    </AnimatePresence>
                )}
            </div>

            <div className='mt-6 border-t border-mk-line pt-6'>
                <p className='text-sm font-medium leading-relaxed text-mk-ink'>
                    {plan.blurb}
                </p>

                <ul className='mt-4 flex flex-col gap-2.5'>
                    {plan.features.map(feature => (
                        <li
                            key={feature}
                            className='flex items-start gap-2 text-sm text-mk-body'>
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                className='mt-0.5 size-4 shrink-0 text-mk-tick'
                            />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            <div className='mt-8 flex flex-1 items-end'>
                {plan.disabled ? (
                    <button
                        type='button'
                        disabled
                        title='Self-serve checkout is coming soon'
                        className={cn(
                            'h-10 w-full cursor-not-allowed rounded-md text-sm font-medium',
                            plan.emphasis === 'solid'
                                ? 'bg-mk-accent text-white opacity-50'
                                : 'border border-mk-line-strong text-mk-faint'
                        )}>
                        {plan.cta}
                    </button>
                ) : (
                    <a
                        href='#contact'
                        className='inline-flex h-10 w-full items-center justify-center rounded-md bg-mk-dark-btn text-sm font-medium text-white transition-colors hover:bg-mk-dark-btn-hover'>
                        {plan.cta}
                    </a>
                )}
            </div>
        </div>
    );
}

/**
 * Decorative product collage standing in for the Laravel Cloud 3D screenshot:
 * three tilted hairline cards with travel-ops fragments.
 */
function PricingCollage() {
    return (
        <div
            className='relative mx-auto h-64 w-full max-w-md select-none'
            aria-hidden='true'>
            <div className='mk-lift absolute top-12 left-0 w-56 -rotate-3 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-card'>
                <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                    Booking BK-2481
                </p>
                <p className='mt-2 text-sm font-medium text-mk-ink'>
                    Santorini Sunset Cruise
                </p>
                <div className='mt-3 flex items-center justify-between border-t border-mk-line pt-3'>
                    <span className='text-xs text-mk-body'>2 travelers</span>
                    <span className='rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                        Confirmed
                    </span>
                </div>
            </div>

            <div className='mk-lift absolute top-0 left-40 z-10 w-64 rotate-2 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-float'>
                <div className='flex items-center justify-between'>
                    <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                        Auto-payouts
                    </p>
                    <span className='rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                        Enabled
                    </span>
                </div>
                <div className='mt-3 flex flex-col gap-2'>
                    <div className='flex justify-between text-xs'>
                        <span className='text-mk-body'>Gross bookings</span>
                        <span className='font-mono text-mk-ink'>$48,290</span>
                    </div>
                    <div className='flex justify-between text-xs'>
                        <span className='text-mk-body'>Supplier payouts</span>
                        <span className='font-mono text-mk-ink'>$31,760</span>
                    </div>
                    <div className='flex justify-between border-t border-mk-line pt-2 text-xs'>
                        <span className='text-mk-body'>Net revenue</span>
                        <span className='font-mono font-semibold text-mk-ink'>
                            $16,530
                        </span>
                    </div>
                </div>
            </div>

            <div className='mk-lift absolute top-36 left-64 hidden w-48 rotate-6 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-card xl:block'>
                <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                    Workflow
                </p>
                <p className='mt-2 text-xs text-mk-body'>
                    Send itinerary 48h before departure
                </p>
                <span className='mt-3 inline-block rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                    Active
                </span>
            </div>
        </div>
    );
}
