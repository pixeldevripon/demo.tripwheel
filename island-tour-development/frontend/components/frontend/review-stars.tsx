import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * The five-star score row used by every review surface.
 *
 * ONE definition, because the two review surfaces had drifted apart: the
 * preview strip on the tour page drew a `★` glyph in `--it-star` (#f5a623, an
 * amber), and the full section repeated the same glyph. Figma draws neither -
 * it uses the exported star at the brand's deep orange (#E8611A), which is the
 * colour the rest of the page already uses for a rating (founder, 2026-08-18:
 * "it uses yellow instead of primary").
 *
 * Figma's sample review is a 5, so it shows five filled stars. A real card has
 * to say WHICH rating it is, so the stars past the score are the same glyph at
 * 20% - one shape, one file, and the row still reads as five stars rather than
 * as a short row of three.
 *
 * The row carries the score as its accessible name; the glyphs themselves are
 * decorative, so a screen reader hears "4 / 5" once instead of five images.
 */
export function ReviewStars({
    rating,
    className,
    size = 14,
}: {
    /** 0-5; rounded to the nearest whole star for the fill. */
    rating: number;
    /** Positioning only. */
    className?: string;
    /**
     * Glyph size in px. Figma draws 16; 14 is the founder's step down (the
     * whole tour page came down a step on 2026-08-18) and keeps the row in
     * proportion to the 14.5px text beside it.
     */
    size?: number;
}) {
    const filled = Math.round(rating);
    return (
        <span
            className={cn('flex items-center gap-1.5', className)}
            role='img'
            aria-label={`${rating} / 5`}>
            {[0, 1, 2, 3, 4].map(i => (
                <Image
                    key={i}
                    src='/icons/tour/star.svg'
                    alt=''
                    width={16}
                    height={15}
                    style={{ width: size, height: size }}
                    className={cn('shrink-0', i >= filled && 'opacity-20')}
                />
            ))}
        </span>
    );
}
