'use client';

/**
 * Anchor-styled CTA that smooth-scrolls to an on-page target (e.g. the hub's
 * trips section) instead of hard-jumping. Mirrors the hero's "Check
 * availability" behaviour (`scrollIntoView({ behavior: 'smooth' })`); falls back
 * to normal anchor navigation if the target id is not on the page.
 */
export function HubScrollButton({
    targetId,
    className,
    children,
}: {
    /** Element id to scroll to (without the leading '#'). */
    targetId: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <a
            href={`#${targetId}`}
            onClick={(e) => {
                const el = document.getElementById(targetId);
                if (!el) return; // let the browser handle the anchor
                e.preventDefault();
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={className}>
            {children}
        </a>
    );
}
