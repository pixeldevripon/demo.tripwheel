'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Reveal } from '@/components/marketing/reveal';

/**
 * Contact (Laravel Cloud ref): editorial pitch + customer quote left, lead
 * form right, split by a centre hairline. No backend yet - the submit is a
 * front-end acknowledgement until the sales inbox integration lands.
 */
export function MarketingContact() {
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitted(true);
        toast.success(
            'Thanks for reaching out - our sales team will be in touch within one business day.'
        );
    }

    return (
        <section
            id='contact'
            className='scroll-mt-16 border-t border-mk-line bg-mk-paper'>
            <div className='grid lg:grid-cols-2'>
                <Reveal className='px-6 py-mk-half md:px-12'>
                    <h2 className='text-mk-title font-medium text-mk-ink md:text-mk-display'>
                        Talk to our sales team
                    </h2>

                    <p className='mt-6 max-w-md text-sm leading-relaxed text-mk-body'>
                        Signing up for TripWheel is the fastest way to start
                        growing. If your agency currently spends more than
                        $2,000 / month on operations tooling, runs multiple
                        branches, or you need migration support, our sales team
                        will be happy to guide you.
                    </p>
                    <p className='mt-4 text-sm leading-relaxed text-mk-body'>
                        Provide your information and we&apos;ll be in touch.
                    </p>

                    <blockquote className='mt-12 max-w-md lg:mt-16'>
                        <p className='text-base font-semibold leading-relaxed text-mk-ink'>
                            &ldquo;We moved our entire agency onto TripWheel in
                            a week. Bookings, payments, supplier payouts - one
                            place, zero spreadsheets.&rdquo;
                        </p>
                        <footer className='mt-4 text-sm font-medium text-mk-faint'>
                            Island Tours
                        </footer>
                    </blockquote>
                </Reveal>

                <Reveal
                    delay={0.1}
                    className='border-t border-mk-line px-6 py-mk-half md:px-12 lg:border-t-0 lg:border-l'>
                    <h3 className='text-sm font-semibold text-mk-ink'>
                        Tell us how we can help
                    </h3>

                    {submitted ? (
                        <div className='mt-8 rounded-lg border border-mk-line bg-mk-canvas p-6'>
                            <p className='text-sm font-medium text-mk-ink'>
                                Message sent
                            </p>
                            <p className='mt-2 text-sm leading-relaxed text-mk-body'>
                                Thanks for reaching out - our sales team will
                                get back to you within one business day.
                            </p>
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className='mt-6 flex flex-col gap-6'>
                            <div>
                                <label htmlFor='mk-name' className='mk-label'>
                                    Full name
                                </label>
                                <input
                                    id='mk-name'
                                    name='name'
                                    aria-label='Full name'
                                    type='text'
                                    required
                                    autoComplete='name'
                                    placeholder='Full name'
                                    className='mk-input'
                                />
                            </div>

                            <div>
                                <label htmlFor='mk-email' className='mk-label'>
                                    Company email
                                </label>
                                <input
                                    id='mk-email'
                                    name='email'
                                    aria-label='Company email'
                                    type='email'
                                    required
                                    autoComplete='email'
                                    placeholder='email@company.com'
                                    className='mk-input'
                                />
                            </div>

                            <div>
                                <label htmlFor='mk-phone' className='mk-label'>
                                    Phone number
                                </label>
                                <input
                                    id='mk-phone'
                                    name='phone'
                                    aria-label='Phone number'
                                    type='tel'
                                    autoComplete='tel'
                                    placeholder='1-(222)-333-4444'
                                    className='mk-input'
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor='mk-message'
                                    className='mk-label'>
                                    How can we help?
                                </label>
                                <textarea
                                    id='mk-message'
                                    name='message'
                                    aria-label='How can we help?'
                                    required
                                    placeholder="I'm interested in TripWheel. I'd like to learn more about..."
                                    className='mk-textarea'
                                />
                            </div>

                            <div className='flex justify-end'>
                                <button
                                    type='submit'
                                    className='inline-flex h-10 items-center rounded-md bg-mk-dark-btn px-6 text-sm font-medium text-white transition-colors hover:bg-mk-dark-btn-hover'>
                                    Send message
                                </button>
                            </div>
                        </form>
                    )}
                </Reveal>
            </div>
        </section>
    );
}
