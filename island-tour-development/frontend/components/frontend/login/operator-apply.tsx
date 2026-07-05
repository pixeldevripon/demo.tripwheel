'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { Field, inputClass, primaryBtn, quietLink } from './login-ui';

/**
 * "Apply to list your tours" (`/apply`). Operators are admin-invited, so this is
 * a lead-capture APPLICATION, not a sign-up - on approval an admin sends the
 * set-password invite (spec: operators created by admin invite). Public,
 * marketing-styled (logo + footer), links back to the operator portal.
 *
 * SCREENS ONLY - submit is mocked (no backend). Fields are sensible defaults for
 * an operator application; adjust once the leads endpoint exists.
 */

// Launch + pipeline destinations (CLAUDE.md). "Other" keeps the form open.
const DESTINATIONS = [
    'Curacao',
    'Aruba',
    'Sint Maarten',
    'Saint Lucia',
    'Bahamas',
    'Other / not listed',
];

export function OperatorApply() {
    const [sent, setSent] = useState(false);

    return (
        <div className='flex min-h-screen flex-col bg-it-bg'>
            <header className='flex items-center justify-between px-7 py-5'>
                <Link href='/' aria-label='Island Tours home' className='shrink-0'>
                    <Image
                        src='/logo/logo.png'
                        alt='Island Tours'
                        width={68}
                        height={50}
                        priority
                        className='h-11 w-auto object-contain'
                    />
                </Link>
                <Link href='/portal' className={quietLink}>
                    Already listing? Operator portal &rarr;
                </Link>
            </header>

            <main className='flex flex-1 justify-center px-5 pb-12 pt-[4vh]'>
                <div className='h-fit w-full max-w-135 rounded-[16px] border border-it-border bg-it-white px-7.5 pb-7 pt-8 shadow-it-md'>
                    <MountReveal key={sent ? 'sent' : 'form'}>
                    {sent ? (
                        <div className='py-6 text-center'>
                            <h1 className='m-0 font-it-display text-[26px] font-semibold tracking-[-0.01em] text-it-heading'>
                                Thanks - we&apos;ve got it.
                            </h1>
                            <p className='mx-auto mt-3 max-w-105 text-[15px] leading-[1.6] text-it-text-muted'>
                                Our team reviews every application and gets back to you by email,
                                usually within a few days. If it&apos;s a fit, we&apos;ll send an
                                invite to set up your operator account.
                            </p>
                            <a
                                href='#'
                                className='mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                                <Image
                                    src='/icons/trust-chat.svg'
                                    alt=''
                                    width={40}
                                    height={40}
                                    className='size-4.5 shrink-0'
                                />
                                Questions? Chat on WhatsApp
                            </a>
                        </div>
                    ) : (
                        <>
                            <h1 className='m-0 font-it-display text-[26px] font-semibold tracking-[-0.01em] text-it-heading'>
                                Apply to list your tours
                            </h1>
                            <p className='mb-6 mt-2 text-[14.5px] leading-[1.55] text-it-text-muted'>
                                Tell us about your business. We onboard operators by invitation - if
                                it&apos;s a fit, we&apos;ll email you an invite to get set up.
                            </p>

                            <form
                                onSubmit={(e) => { e.preventDefault(); setSent(true); }}
                                className='grid grid-cols-1 gap-x-4 sm:grid-cols-2'>
                                <Field label='Business name' htmlFor='a-company'>
                                    <input
                                        id='a-company'
                                        name='company'
                                        type='text'
                                        autoComplete='organization'
                                        placeholder='e.g. Blue Bay Charters'
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label='Your name' htmlFor='a-name'>
                                    <input
                                        id='a-name'
                                        name='contactName'
                                        type='text'
                                        autoComplete='name'
                                        placeholder='First and last name'
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label='Email' htmlFor='a-email'>
                                    <input
                                        id='a-email'
                                        name='email'
                                        type='email'
                                        autoComplete='email'
                                        inputMode='email'
                                        placeholder='you@yourcompany.com'
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label='WhatsApp / phone' htmlFor='a-phone'>
                                    <input
                                        id='a-phone'
                                        name='phone'
                                        type='tel'
                                        autoComplete='tel'
                                        inputMode='tel'
                                        placeholder='+599 ...'
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label='Main island' htmlFor='a-destination'>
                                    <select
                                        id='a-destination'
                                        name='destination'
                                        defaultValue=''
                                        className={inputClass}>
                                        <option value='' disabled>
                                            Choose a destination
                                        </option>
                                        {DESTINATIONS.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label='Website or social link' htmlFor='a-website'>
                                    <input
                                        id='a-website'
                                        name='website'
                                        type='url'
                                        autoComplete='url'
                                        placeholder='https://'
                                        className={inputClass}
                                    />
                                </Field>

                                <div className='sm:col-span-2'>
                                    <Field label='What tours do you offer?' htmlFor='a-tours'>
                                        <textarea
                                            id='a-tours'
                                            name='tours'
                                            rows={4}
                                            placeholder='Tour types, group sizes, how long you have been operating, anything else we should know.'
                                            className={`${inputClass} resize-y`}
                                        />
                                    </Field>
                                </div>

                                <div className='sm:col-span-2'>
                                    <button type='submit' className={primaryBtn}>
                                        Send application
                                    </button>
                                    <p className='mt-3 text-center text-[12.5px] text-it-text-muted'>
                                        By applying you agree to our{' '}
                                        <a href='#' className='underline'>
                                            Terms
                                        </a>{' '}
                                        and{' '}
                                        <a href='#' className='underline'>
                                            Privacy Policy
                                        </a>
                                        .
                                    </p>
                                </div>
                            </form>
                        </>
                    )}
                    </MountReveal>
                </div>
            </main>
        </div>
    );
}
