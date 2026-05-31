'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
    {
        q: 'Can I cancel if my plans change?',
        a: 'Most tours can be cancelled up to 24h before for a full refund. No forms, just message us on WhatsApp and we\'ll sort it out immediately.',
    },
    {
        q: 'Do I have to pay in full now?',
        a: 'No — you can secure your spot with just 20% upfront. Pay the remaining balance closer to your tour date. Full payment is required 48h before departure.',
    },
    {
        q: 'Who is behind Island Tours?',
        a: 'We\'re a team of islanders who grew up on Curaçao, Aruba, and Sint Maarten. Every tour on our platform is one we\'ve personally vetted or experienced ourselves.',
    },
    {
        q: 'What if my tour gets cancelled?',
        a: 'If a tour is cancelled by the operator, you get a full refund within 24 hours — no questions asked. We\'ll also suggest alternatives if you\'d like.',
    },
    {
        q: 'Not sure which tour? We\'ll help.',
        a: 'Chat with us on WhatsApp anytime. Tell us what kind of experience you\'re after and we\'ll give you honest, local recommendations.',
    },
];

function FaqItem({ item }: { item: typeof faqs[0] }) {
    const [open, setOpen] = useState(false);

    return (
        <div className='border-b border-it-border last:border-b-0'>
            <button
                onClick={() => setOpen(!open)}
                className='w-full flex items-center justify-between gap-4 py-5 text-left bg-transparent border-none cursor-pointer'
            >
                <span className='text-base font-semibold text-it-ink tracking-tight'>{item.q}</span>
                <span className='shrink-0 size-7 rounded-it-full border border-it-border flex items-center justify-center text-it-ink-muted'>
                    {open ? <Minus size={14} /> : <Plus size={14} />}
                </span>
            </button>

            {open && (
                <p className='m-0 pb-5 text-sm text-it-ink-muted leading-relaxed max-w-2xl'>
                    {item.a}
                </p>
            )}
        </div>
    );
}

export function FaqSection() {
    return (
        <section className='it-section bg-it-surface'>
            <div className='it-container'>
                <div className='grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20'>
                    {/* Left */}
                    <div>
                        <h2 className='m-0 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold text-it-ink tracking-[-0.03em] leading-tight'>
                            Need help before booking?
                        </h2>
                        <p className='mt-4 text-sm text-it-ink-muted leading-relaxed'>
                            We&apos;re locals. We grew up here, we know these tours, and we want you to have the best time on these islands.
                        </p>
                        <button className='mt-6 flex items-center gap-2 text-sm font-medium text-it-green'>
                            <span className='size-2 rounded-full bg-it-green' />
                            Chat with us now
                        </button>
                    </div>

                    {/* Right — accordion */}
                    <div className='bg-it-white rounded-it-lg px-8 py-2'>
                        {faqs.map((faq) => (
                            <FaqItem key={faq.q} item={faq} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
