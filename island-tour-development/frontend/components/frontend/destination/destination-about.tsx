import Image from 'next/image';
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
 * One item in the band under the About copy. `body` is null on the bundled
 * fallback set, which has never had body copy - those render as the bare label
 * links they are today.
 */
export type AboutSection = {
    /** In-page jump target WITHOUT the leading '#'. Null renders plain copy. */
    anchor: string | null;
    heading: string;
    body: string | null;
};

/**
 * The three bundled labels, used when an island has no authored sections. They
 * point at sections further down the destination page, so the anchors here must
 * keep matching the ids those sections render.
 */
export function fallbackAboutSections(dict: AboutDict): AboutSection[] {
    return [
        { anchor: 'experiences', heading: dict.topThings, body: null },
        { anchor: 'planning', heading: dict.planning, body: null },
        { anchor: 'faq', heading: dict.whyBook, body: null },
    ];
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className='relative size-6 shrink-0'>
                <Image
                    src='/icons/check-green.svg'
                    alt=''
                    fill
                    className='object-contain'
                />
            </div>
            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                {children}
            </span>
        </>
    );
}

function AboutSectionItem({ section }: { section: AboutSection }) {
    // A section with an anchor is in-page navigation; without one it is just copy.
    const heading = section.anchor ? (
        <a
            href={`#${section.anchor}`}
            className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
            <SectionHeading>{section.heading}</SectionHeading>
        </a>
    ) : (
        <div className='flex items-center gap-2 text-it-heading'>
            <SectionHeading>{section.heading}</SectionHeading>
        </div>
    );

    if (!section.body) return heading;

    return (
        <div className='flex flex-col gap-2 md:flex-1'>
            {heading}
            <p className='m-0 pl-8 text-base leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                {section.body}
            </p>
        </div>
    );
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
    // Authored sections carry body copy and need room to breathe; the bundled
    // label-only set keeps the single spread-out row it has always been.
    const hasBody = sections.some((s) => s.body);

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

                    {/* Bottom Section: Three Columns & Divider Line */}
                    <div className='flex flex-col gap-10 md:gap-12'>
                        <div
                            className={
                                hasBody
                                    ? 'flex flex-col md:flex-row items-start gap-8 md:gap-10 w-full'
                                    : 'flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 md:gap-0 w-full'
                            }>
                            {sections.map((section) => (
                                <AboutSectionItem
                                    key={`${section.anchor ?? ''}-${section.heading}`}
                                    section={section}
                                />
                            ))}
                        </div>

                        {/* Divider line matching Line 18 in Figma (rgba(44,44,44,0.1) opacity stroke) */}
                        <div className='w-full h-px bg-it-heading/10' />
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
