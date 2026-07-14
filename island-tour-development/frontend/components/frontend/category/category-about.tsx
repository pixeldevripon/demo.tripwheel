import { AboutExpander } from '../about-expander';
import { Reveal } from '../reveal';

/**
 * Category-page "About" block (Figma node 47171:5647). A simpler twin of
 * <DestinationAbout>: heading + body copy with an inline "Learn More" expander,
 * on the #f8f8f8 band. No three-column nav / divider (that's the destination
 * variant). Server component - the expander is the client leaf.
 */
export function CategoryAbout({
    title,
    description,
    learnMoreLabel,
    readLessLabel,
}: {
    title: string;
    description: string;
    learnMoreLabel: string;
    readLessLabel: string;
}) {
    return (
        // Desktop: 130px top / 20px bottom (tight gap to the FAQ band).
        // Mobile: 32px top / 0 bottom - the FAQ band's 64px top makes the gap.
        <section className='it-section md:pb-5! max-md:pt-8! max-md:pb-0! bg-it-surface'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-4 md:gap-10'>
                    <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    <AboutExpander
                        description={description}
                        moreLabel={learnMoreLabel}
                        lessLabel={readLessLabel}
                        className='m-0 text-[14px] md:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'
                        buttonClassName='ml-1.5 inline cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors duration-300 hover:text-it-primary'
                    />
                </Reveal>
            </div>
        </section>
    );
}
