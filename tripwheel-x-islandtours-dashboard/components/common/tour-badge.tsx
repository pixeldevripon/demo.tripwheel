/**
 * Admin tour badge chip (master §3.6 badge set).
 *
 * The dashboard's own chip, deliberately NOT the storefront's. The public chip
 * (`components/frontend/tour-badge`) is pinned to the Figma hex values and grows
 * inside a card's @container; reusing it here coupled the admin UI to the
 * storefront's styling, so a shop restyle silently restyled the dashboard.
 *
 * This renders the same INFORMATION - the same four badge types, the same
 * labels - through dashboard semantic tokens, at one dense size. The mapping to
 * meaning (rather than to the shop's palette) is the point: `likelyToSellOut` is
 * urgency, `mostPopular` is a positive signal, `new` is informational, and
 * `sponsored` is neutral (master §3.6: "rounded rectangle, gray" - never brand
 * orange).
 *
 * Each chip carries its text label, so type is never conveyed by color alone
 * (WCAG 1.4.1). Server-safe: no hooks, no browser APIs.
 */
import type { TourBadge } from '@/lib/tours/derive-badge';
import { cn } from '@/lib/utils';

/**
 * The subtle triplet (`border-{v}/30 bg-{v}/10 text-{v}`) is the convention
 * already used elsewhere in the dashboard. It is the shape the design system
 * standardizes as `StatusBadge`, so this chip folds into it without a redesign.
 */
const BADGE_STYLE: Record<Exclude<TourBadge, null>, { className: string; label: string }> = {
  sponsored: {
    className: 'border-border bg-muted text-muted-foreground',
    label: 'Sponsored',
  },
  new: {
    className: 'border-info/30 bg-info/10 text-info',
    label: 'New',
  },
  likelyToSellOut: {
    className: 'border-warning/30 bg-warning/10 text-warning',
    label: 'Likely to sell out',
  },
  mostPopular: {
    className: 'border-success/30 bg-success/10 text-success',
    label: 'Most popular',
  },
};

interface TourBadgeChipProps {
  type: TourBadge;
  className?: string;
}

export function TourBadgeChip({ type, className }: TourBadgeChipProps) {
  if (!type) return null;
  const style = BADGE_STYLE[type];
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center justify-center rounded-full border px-2 text-[11px] font-medium leading-none',
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
