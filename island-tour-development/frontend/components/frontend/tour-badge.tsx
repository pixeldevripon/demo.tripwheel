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
    sponsored: { className: 'bg-[#f8f8f8] text-[#2c2c2c]', label: 'Sponsored' },
    // Figma: bg #fdf6f0, text #2c2c2c
    new: { className: 'bg-[#fdf6f0] text-[#2c2c2c]', label: 'New' },
    // Figma: bg #193c5e, text white
    likelyToSellOut: {
        className: 'bg-[#193c5e] text-white',
        label: 'Likely to sell out',
    },
    // Figma: bg #e8611a, text white
    mostPopular: {
        className: 'bg-[#e8611a] text-white',
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
            ? // min-w-0 + truncate: on narrow image areas (mobile row cards) the
              // chip shortens with an ellipsis instead of running under the heart.
              'min-w-0 truncate px-[7px] py-[3px] text-[10px] @[220px]:px-[9px] @[220px]:py-1 @[220px]:text-[11.5px]'
            : 'h-5 shrink-0 px-2.5 text-[11px]';
    return (
        <span
            className={[
                // Design v2 .badge: small radius (6px), bold, tight tracking
                'inline-flex items-center justify-center rounded-[6px] font-bold leading-[1.4] tracking-[0.01em]',
                sizeClass,
                style.className,
                className,
            ].join(' ')}>
            {label ?? style.label}
        </span>
    );
}

