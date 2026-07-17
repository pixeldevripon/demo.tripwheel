'use client';

import { MinusSignIcon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from './reveal';

import { FAQS } from '@/lib/faqs';


/**
 * FAQ (Clarasight ref): chip + editorial headline left, accordion cards
 * right. First item open by default; height animates via framer-motion.
 */
export function MarketingFaq() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            id='faqs'
            className='border-t border-mk-line bg-mk-canvas px-6 py-mk-section md:px-12'>
            <div className='grid gap-12 lg:grid-cols-[1fr_1.4fr]'>
                <Reveal>
                    <span className='inline-block rounded-md bg-mk-accent-soft px-2.5 py-1 text-2xs font-semibold text-mk-accent-soft-fg'>
                        FAQs
                    </span>
                    <h2 className='mt-4 text-mk-title font-medium text-mk-ink'>
                        Questions? Answers.
                    </h2>
                    <p className='mt-4 max-w-sm text-sm leading-relaxed text-mk-body'>
                        Your most frequently asked questions, all in one place.
                        If you don&apos;t see what you need, reach out to us.
                    </p>
                </Reveal>

                <Reveal delay={0.1} className='flex flex-col gap-3'>
                    {FAQS.map((faq, index) => (
                        <FaqItem
                            key={faq.question}
                            question={faq.question}
                            answer={faq.answer}
                            open={openIndex === index}
                            onToggle={() =>
                                setOpenIndex(
                                    openIndex === index ? null : index
                                )
                            }
                        />
                    ))}
                </Reveal>
            </div>
        </section>
    );
}

function FaqItem({
    question,
    answer,
    open,
    onToggle,
}: {
    question: string;
    answer: string;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <div className='rounded-xl border border-mk-line bg-mk-paper'>
            <button
                type='button'
                onClick={onToggle}
                aria-expanded={open}
                className='flex w-full items-center justify-between gap-4 px-6 py-4 text-left'>
                <span className='text-sm font-medium text-mk-ink'>
                    {question}
                </span>
                <HugeiconsIcon
                    icon={open ? MinusSignIcon : PlusSignIcon}
                    className='size-4 shrink-0 text-mk-faint'
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            duration: 0.3,
                            ease: [0.25, 1, 0.5, 1],
                        }}
                        className='overflow-hidden'>
                        <p className='px-6 pb-6 text-sm leading-relaxed text-mk-body'>
                            {answer}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
