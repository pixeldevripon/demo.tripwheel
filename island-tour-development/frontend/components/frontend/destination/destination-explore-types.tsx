import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from '../reveal';
import { SectionHead } from '../section-head';
import { SeeAllLink } from '../see-all-link';
import { ExploreTypesRail, type ExploreType } from './explore-types-rail';

export type { ExploreType };

/**
 * "Explore by type" on the Destination page: the section head plus the shared
 * tile rail.
 *
 * The carousel itself lives in `ExploreTypesRail` - the search recovery band
 * mounts that rail on its own, under a different head, so the two surfaces can
 * never drift into two different carousels.
 */
export function DestinationExploreTypes({
    dict,
    locale,
    destinationSlug,
    destinationName,
    categories,
}: {
    dict: {
        title: string;
        tours: string;
        /** "All {destination} tours" - the section head's link label. */
        allTours: string;
    };
    locale: Locale;
    destinationSlug: string;
    /** Island display name - the 'All {name} tours' link label. */
    destinationName: string;
    categories: ExploreType[];
}) {
    const allToursHref = localizeHref(locale, `/${destinationSlug}/tours`);

    return (
        <section className='bg-it-surface it-section'>
            <div className='it-container'>
                {/* Static-shell section: PageTransition owns the page-enter, so no
                    section-level mount animation (it would flash on hydration).
                    The cards stagger on scroll instead. */}
                <Reveal className='flex flex-col gap-5'>
                    <SectionHead
                        title={dict.title}
                        action={
                            <SeeAllLink
                                href={allToursHref}
                                label={dict.allTours.replace(
                                    '{destination}',
                                    destinationName
                                )}
                                className='whitespace-nowrap max-sm:hidden'
                            />
                        }
                    />

                    <ExploreTypesRail
                        locale={locale}
                        destinationSlug={destinationSlug}
                        categories={categories}
                        toursLabel={dict.tours}
                    />
                </Reveal>
            </div>
        </section>
    );
}

