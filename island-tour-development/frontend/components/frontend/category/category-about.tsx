import { AboutExpander } from '../about-expander';
import { Reveal } from '../reveal';

/**
 * Category-page "About" block (design v2 .catcontent): display heading + the
 * 14.5px ink body copy with an inline "Learn More" expander, on the white
 * page surface in a 760px reading column. Server component - the expander is
 * the client leaf.
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
        <section className='bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-3'>
                    <h2 className='m-0 mt-13 text-[20px] md:text-[26px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {title}
                    </h2>

                    <AboutExpander
                        description={description}
                        moreLabel={learnMoreLabel}
                        lessLabel={readLessLabel}
                        className='m-0 text-[13px] leading-[1.7] text-it-heading tracking-[-0.012em]'
                        buttonClassName='mt-1.5 block cursor-pointer border-none bg-transparent p-0 it-text  font-medium text-it-primary-hover underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary'
                    />
                </Reveal>
            </div>
        </section>
    );
}

