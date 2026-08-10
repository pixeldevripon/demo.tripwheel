import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourCardCarousel } from './tour-card-carousel';

/**
 * The S4j signifier contract, as executable checks:
 *
 * 1. Dots are ALWAYS in the DOM and quiet at rest - not hover-gated. The
 *    hover-only version is exactly the regression these tests exist to block:
 *    a card at rest gave no signal that more photos existed.
 * 2. Chevrons are position-aware and never wrap: no "previous" on photo 1, no
 *    "next" on the last slide.
 * 3. Chevron clicks drive the scroll-snap track (smooth normally, instant
 *    under prefers-reduced-motion) and never leak to the card link.
 * 4. Five slides max; a single image renders no controls at all.
 * 5. The description slide (title + teaser + "full details" line) renders
 *    LAST, on top of the five-photo cap, and recolors the dots for its light
 *    surface.
 */

const DICT = { prevAria: 'Previous photo', nextAria: 'Next photo' };
const IMAGES = ['/a.jpg', '/b.jpg', '/c.jpg'];

/** The scroll-snap slide track (the only scrollable element the card renders). */
const getTrack = (container: HTMLElement) =>
    container.querySelector('.snap-x') as HTMLElement;

/** The aria-hidden dots row (chevron icons are `img`s, so this div is unique). */
const getDots = (container: HTMLElement) =>
    container.querySelector('div[aria-hidden="true"]') as HTMLElement;

const renderCarousel = (images: string[] = IMAGES) =>
    render(<TourCardCarousel images={images} alt='Catamaran Day Trip' {...DICT} />);

/** Swipe/scroll the track to a slide and fire the scroll event. */
function scrollToSlide(track: HTMLElement, slide: number) {
    track.scrollLeft = slide * 300;
    fireEvent.scroll(track);
}

beforeAll(() => {
    // jsdom has no layout: give every element the width the index math divides
    // by, so `scrollLeft / clientWidth` behaves like a 300px-wide card.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        value: 300,
    });
});

afterAll(() => {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});

beforeEach(() => {
    // jsdom does not implement element scrolling; a fresh spy per test keeps
    // call counts isolated.
    HTMLElement.prototype.scrollTo = vi.fn(function (
        this: HTMLElement,
        opts?: ScrollToOptions | number
    ) {
        if (typeof opts === 'object' && opts?.left !== undefined) {
            this.scrollLeft = opts.left;
        }
    }) as typeof HTMLElement.prototype.scrollTo;
});

describe('TourCardCarousel - quiet dots always visible (rest state)', () => {
    it('renders the dots row at rest, quiet (60%) rather than hidden', () => {
        const { container } = renderCarousel();
        const dots = getDots(container);
        expect(dots).toBeInTheDocument();
        expect(dots.children).toHaveLength(3);
        // Quiet, not invisible: the row must NOT be the old hover-gated
        // `opacity-0`, and must carry the rest-state 60% + reveal classes.
        expect(dots.className).toContain('opacity-60');
        expect(dots.className).not.toMatch(/opacity-0(?![.\d])/);
        expect(dots.className).toContain('group-hover:opacity-100');
        expect(dots.className).toContain('group-focus-within:opacity-100');
    });

    it('marks the active dot from the scroll position (6px active, 5px idle)', () => {
        const { container } = renderCarousel();
        const dots = getDots(container);
        expect(dots.children[0].className).toContain('size-1.5');
        expect(dots.children[1].className).toContain('size-1.25');
        scrollToSlide(getTrack(container), 1);
        expect(dots.children[0].className).toContain('bg-it-white/60');
        expect(dots.children[1].className).toContain('size-1.5');
    });
});

describe('TourCardCarousel - position-aware chevrons (no wrap)', () => {
    it('shows only "next" on the first photo', () => {
        renderCarousel();
        expect(
            screen.getByRole('button', { name: 'Next photo' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Previous photo' })
        ).not.toBeInTheDocument();
    });

    it('shows both chevrons on a middle slide', () => {
        const { container } = renderCarousel();
        scrollToSlide(getTrack(container), 1);
        expect(
            screen.getByRole('button', { name: 'Previous photo' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Next photo' })
        ).toBeInTheDocument();
    });

    it('shows only "previous" on the last slide', () => {
        const { container } = renderCarousel();
        scrollToSlide(getTrack(container), 2);
        expect(
            screen.getByRole('button', { name: 'Previous photo' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Next photo' })
        ).not.toBeInTheDocument();
    });

    it('hides the chevron layer from touch devices, not the dots', () => {
        const { container } = renderCarousel();
        const chevronRow = screen.getByRole('button', { name: 'Next photo' })
            .parentElement as HTMLElement;
        expect(chevronRow.className).toContain('pointer-coarse:hidden');
        expect(getDots(container).className).not.toContain('pointer-coarse:hidden');
    });
});

describe('TourCardCarousel - chevrons drive the scroll-snap track', () => {
    it('scrolls one card width forward, smoothly by default', () => {
        const { container } = renderCarousel();
        fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
        expect(getTrack(container).scrollTo).toHaveBeenCalledWith({
            left: 300,
            behavior: 'smooth',
        });
    });

    it('jumps instantly under prefers-reduced-motion', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: true,
        } as MediaQueryList);
        const { container } = renderCarousel();
        fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
        expect(getTrack(container).scrollTo).toHaveBeenCalledWith({
            left: 300,
            behavior: 'auto',
        });
    });

    it('steps from the live scroll offset and clamps at the end', () => {
        const { container } = renderCarousel();
        const track = getTrack(container);
        scrollToSlide(track, 1);
        fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
        expect(track.scrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ left: 600 })
        );
        // Now on the last slide: no "next" to click, and "previous" steps back.
        fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
        expect(track.scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ left: 300 })
        );
    });

    it('never lets a chevron click reach the card link', () => {
        const onCardClick = vi.fn();
        render(
            <a href='/en/curacao/catamaran' onClick={onCardClick}>
                <TourCardCarousel images={IMAGES} alt='Catamaran' {...DICT} />
            </a>
        );
        const notCancelled = fireEvent.click(
            screen.getByRole('button', { name: 'Next photo' })
        );
        expect(onCardClick).not.toHaveBeenCalled();
        // preventDefault fired - the button can live inside a link-card.
        expect(notCancelled).toBe(false);
    });
});

describe('TourCardCarousel - slide set', () => {
    it('caps the track and the dots at five slides', () => {
        const seven = Array.from({ length: 7 }, (_, i) => `/p${i}.jpg`);
        const { container } = renderCarousel(seven);
        expect(container.querySelectorAll('img[alt^="Catamaran"]')).toHaveLength(5);
        expect(getDots(container).children).toHaveLength(5);
    });

    it('renders no controls for a single image', () => {
        const { container } = renderCarousel(['/only.jpg']);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(getDots(container)).toBeNull();
        expect(screen.getByRole('img', { name: 'Catamaran Day Trip' })).toBeInTheDocument();
    });

    it('renders nothing at all without images', () => {
        const { container } = renderCarousel([]);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('TourCardCarousel - description slide (S4j #4)', () => {
    const DESC = {
        title: 'Catamaran Day Trip',
        description: 'A full day to Klein Curaçao: the white beach and a BBQ lunch.',
        linkLabel: 'Full details on the tour page',
    };
    const renderWithDesc = (images: string[] = IMAGES) =>
        render(
            <TourCardCarousel
                images={images}
                alt='Catamaran Day Trip'
                {...DICT}
                descSlide={DESC}
            />
        );

    it('renders title, teaser and the full-details line as the last slide', () => {
        const { container } = renderWithDesc();
        const track = getTrack(container);
        const last = track.lastElementChild as HTMLElement;
        expect(last.textContent).toContain(DESC.title);
        expect(last.textContent).toContain(DESC.description);
        expect(last.textContent).toContain(DESC.linkLabel);
        // The card is the one link (S4j #5) - the line is a label, not an <a>.
        expect(last.querySelector('a')).toBeNull();
    });

    it('rides on top of the photo cap: 7 photos become 5 + description (6 slides)', () => {
        const seven = Array.from({ length: 7 }, (_, i) => `/p${i}.jpg`);
        const { container } = renderWithDesc(seven);
        expect(container.querySelectorAll('img[alt^="Catamaran"]')).toHaveLength(5);
        expect(getDots(container).children).toHaveLength(6);
    });

    it('recolors the dots (ink idle / orange active, no shadow) on the description slide', () => {
        const { container } = renderWithDesc();
        const track = getTrack(container);
        scrollToSlide(track, 3); // 3 photos + desc -> index 3 is the desc slide
        const dots = getDots(container);
        expect(dots.className).not.toContain('drop-shadow');
        expect(dots.children[3].className).toContain('bg-it-primary-hover');
        expect(dots.children[0].className).toContain('bg-it-ink/28');
        // And it is the last slide: no "next", position-aware as ever.
        expect(
            screen.queryByRole('button', { name: 'Next photo' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Previous photo' })
        ).toBeInTheDocument();
    });

    it('makes a single-photo tour a two-slide carousel (photo + description)', () => {
        const { container } = renderWithDesc(['/only.jpg']);
        expect(getDots(container).children).toHaveLength(2);
        expect(
            screen.getByRole('button', { name: 'Next photo' })
        ).toBeInTheDocument();
    });
});

describe('TourCardCarousel - per-photo scrim', () => {
    it('scrims each photo when asked, never the description slide', () => {
        const { container } = render(
            <TourCardCarousel
                images={IMAGES}
                alt='Catamaran'
                {...DICT}
                scrim
                descSlide={{ title: 't', description: 'd', linkLabel: 'l' }}
            />
        );
        const track = getTrack(container);
        expect(track.querySelectorAll('[class*="scrim-tile"]')).toHaveLength(3);
        expect(
            (track.lastElementChild as HTMLElement).querySelector('[class*="scrim-tile"]')
        ).toBeNull();
    });

    it('renders no scrim by default (the hub pick card look)', () => {
        const { container } = render(
            <TourCardCarousel images={IMAGES} alt='Catamaran' {...DICT} />
        );
        expect(container.querySelectorAll('[class*="scrim-tile"]')).toHaveLength(0);
    });
});

describe('TourCardCarousel - slides clip their content', () => {
    it('every photo slide is overflow-hidden, so the hover zoom cannot leak into the neighbor', () => {
        // Regression: the cards scale imgs 1.03 on card hover; without per-slide
        // clipping the scaled photo painted a sliver of the NEXT slide into view
        // and shifted the snap geometry.
        const { container } = renderCarousel();
        const slides = Array.from(getTrack(container).children) as HTMLElement[];
        expect(slides).toHaveLength(3);
        for (const slide of slides) {
            expect(slide.className).toContain('overflow-hidden');
        }
    });
});
