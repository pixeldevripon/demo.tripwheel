'use client';

import { useState } from 'react';
import { Reveal } from './reveal';

/**
 * Activity Hub "Why {hub}" section (Figma node 48024:11174 desktop /
 * 48539:15988 mobile). A heading + editorial body on the #f8f8f8 band.
 *
 * Desktop shows the full multi-paragraph body. Mobile clamps the body (~5 lines)
 * and reveals the rest with a "Learn More" / "Read Less" toggle — the toggle is
 * mobile-only (`md:hidden`), matching the Figma where desktop has no expander.
 */
export function HubWhySection({
    title,
    paragraphs,
    learnMoreLabel,
    readLessLabel,
}: {
    title: string;
    paragraphs: string[];
    learnMoreLabel: string;
    readLessLabel: string;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        // Mobile py 32px (vs the it-section 64px default); desktop keeps 130px.
        <section className='it-section max-md:py-8! bg-it-surface'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-4 md:gap-12'>
                    <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    <div className='flex flex-col gap-6'>
                        {paragraphs.map((paragraph, i) => (
                            <p
                                key={i}
                                className={`m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted ${
                                    !expanded && i === 0
                                        ? 'line-clamp-5 md:line-clamp-none'
                                        : ''
                                } ${!expanded && i > 0 ? 'hidden md:block' : ''}`}>
                                {paragraph}
                            </p>
                        ))}

                        {/* Learn More — mobile only (desktop shows the full body). */}
                        <button
                            type='button'
                            onClick={() => setExpanded((v) => !v)}
                            className='self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary md:hidden'>
                            {expanded ? readLessLabel : learnMoreLabel}
                        </button>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
