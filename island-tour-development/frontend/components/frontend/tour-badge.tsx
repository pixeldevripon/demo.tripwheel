/**
 * Reusable tour badge chip (master §3.6 badge set).
 *
 * Colors are hardcoded to the frontend design-token hex values (--it-heading
 * #2c2c2c, --it-white #ffffff, --it-surface #f8f8f8) so the chip renders
 * IDENTICALLY on the public site and in the dashboard — the `--it-*` CSS vars are
 * only in scope under `.frontend-root`, so a token-based chip would lose its
 * colors anywhere else. Keep this component self-contained.
 */

export type TourBadge =
    | 'new'
    | 'likelyToSellOut'
    | 'mostPopular'
    | 'sponsored'
    | null;

const BADGE_STYLE: Record<
    Exclude<TourBadge, null>,
    { className: string; label: string }
> = {
    // Master §3.6: "rounded rectangle, gray" — neutral, never brand orange.
    sponsored: { className: 'bg-[#f8f8f8] text-[#2c2c2c] tracking-[-0.012em]', label: 'Sponsored' },
    // Figma: bg #fdf6f0, text #2c2c2c
    new: { className: 'bg-[#fdf6f0] text-[#2c2c2c] tracking-[-0.012em]', label: 'New' },
    // Figma: bg #193c5e, text white
    likelyToSellOut: {
        className: 'bg-[#193c5e] text-white tracking-[-0.012em]',
        label: 'Likely to sell out',
    },
    // Figma: bg #e8611a, text white
    mostPopular: {
        className: 'bg-[#e8611a] text-white tracking-[-0.012em]',
        label: 'Most popular',
    },
};

interface TourBadgeChipProps {
    type: TourBadge;
    /** Localized label override; defaults to the English master label. */
    label?: string;
    /**
     * 'responsive' = the public card's @container sizing (grows in wide cells);
     * 'sm' = a fixed compact size for dense UIs like the dashboard.
     */
    size?: 'responsive' | 'sm';
    className?: string;
}

export function TourBadgeChip({
    type,
    label,
    size = 'sm',
    className = '',
}: TourBadgeChipProps) {
    if (!type) return null;
    const style = BADGE_STYLE[type];
    const sizeClass =
        size === 'responsive'
            ? // The chip WRAPS rather than truncating. It used to carry
              // `min-w-0 truncate`, which on the narrow image of a mobile row
              // card cut "Likely to sell out" down to "Likely to sell ou" - a
              // badge that says something other than what it means. Master §3.6
              // gives the badge a shape, not a width, so it sizes to its label.
              //
              // No padding or font tweak could fix this generally: German is
              // "Wahrscheinlich ausverkauft", half again as long as the English,
              // against roughly 79px of image left over once the wishlist heart
              // takes its corner. Wrapping is the only thing that holds in all 7
              // locales.
              //
              // Dropping `min-w-0` is the load-bearing half: it restores the
              // flex default (min-width: auto), so the chip can never be
              // squeezed narrower than its longest word and pushed into
              // overflow. It shrinks to that floor, then grows downward.
              'px-[7px] py-[3px] text-[12px] @[220px]:px-[9px] @[220px]:py-1 @[220px]:text-[12px] tracking-[-0.012em] font-normal'
            : // Dense UIs (dashboard) size to content already. `min-h-5` rather
              // than a fixed `h-5` so a wrapped label grows the chip instead of
              // spilling out of it.
              'min-h-5 shrink-0 px-2.5 text-[12px] tracking-[-0.012em]';
    return (
        <span
            className={[
                // Design v2 .badge: small radius (6px), bold, tight tracking
                'inline-flex items-center justify-center rounded-full text-center font-normal leading-[1.4] tracking-[-0.012em]',
                sizeClass,
                style.className,
                className,
            ].join(' ')}>
            {label ?? style.label}
        </span>
    );
}

