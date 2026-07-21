import { AboutExpander } from '../about-expander';
import { Reveal } from '../reveal';

export type AboutDict = {
    title: string;
    description: string;
    learnMore: string;
    readLess: string;
    topThings: string;
    planning: string;
    whyBook: string;
};

/**
 * One authored block in the About band: a heading and a paragraph. `body` is
 * null only on the bundled fallback set, which has never had body copy - those
 * render as the bare headings they have always been.
 */
export type AboutSection = {
    heading: string;
    body: string | null;
};

/**
 * The three bundled labels, used when an island has no authored sections yet.
 * Headings only: the dictionary has never carried body copy for them, and
 * inventing some here would put the same generic paragraph on every island -
 * exactly what moving this content into the CMS was meant to end.
 */
export function fallbackAboutSections(dict: AboutDict): AboutSection[] {
    return [
        { heading: dict.topThings, body: null },
        { heading: dict.planning, body: null },
        { heading: dict.whyBook, body: null },
    ];
}

export function DestinationAbout({
    destinationName,
    description,
    sections,
    dict,
}: {
    destinationName: string;
    /**
     * The island's authored About copy. The caller resolves it (CMS value, else
     * the bundled `dict.description`), so this component never decides which
     * source wins.
     */
    description: string;
    /**
     * The band under the copy. The caller resolves it the same way (authored
     * rows, else `fallbackAboutSections(dict)`).
     */
    sections: AboutSection[];
    dict: AboutDict;
}) {
    return (
        <section className='it-section pt-[32px]! bg-it-surface border-b border-it-heading/5'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10 md:gap-12'>
                    {/* Top Section: Title & Body Copy */}
                    <div className='flex flex-col gap-6 md:gap-8'>
                        <h2 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.title.replace(
                                '{destination}',
                                destinationName
                            )}
                        </h2>

                        <AboutExpander
                            description={description}
                            moreLabel={dict.learnMore}
                            lessLabel={dict.readLess}
                            className='m-0 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-text-muted'
                            buttonClassName='ml-1.5 inline cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors duration-300 hover:text-it-primary'
                        />
                    </div>

                    {/* Three authored columns, each under its own rule. */}
                    <div className='grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10'>
                        {sections.map(section => (
                            <div
                                key={section.heading}
                                className='flex flex-col gap-4 border-t border-it-heading/15 pt-6'>
                                <h3 className='m-0 font-semibold text-[20px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                                    {section.heading}
                                </h3>
                                {section.body && (
                                    <p className='m-0 text-[15px] leading-[1.7] tracking-[-0.006em] text-it-text-muted'>
                                        {section.body}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
