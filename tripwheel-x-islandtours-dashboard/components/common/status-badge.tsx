import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * StatusBadge - the ONLY way to color a status (03 §5.1).
 *
 * A status surface is `bg-{v}-subtle border-{v}-border text-{v}-fg`, always
 * that triplet, never a palette class. The leading dot AND the text label are
 * mandatory: color must never be the sole carrier of meaning (WCAG 1.4.1
 * Level A) - a red/green deficit reader must still tell a confirmed booking
 * from a cancelled one.
 *
 * Do not add a status color anywhere else. If a state is missing, add it to
 * the domain maps in ./status-maps.ts.
 */

export type StatusVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const surface: Record<StatusVariant, string> = {
    neutral: 'bg-surface-inset border-line text-content-muted',
    success: 'bg-success-subtle border-success-border text-success-fg',
    warning: 'bg-warning-subtle border-warning-border text-warning-fg',
    danger: 'bg-danger-subtle border-danger-border text-danger-fg',
    info: 'bg-info-subtle border-info-border text-info-fg',
};

const dot: Record<StatusVariant, string> = {
    neutral: 'bg-content-subtle',
    success: 'bg-success-solid',
    warning: 'bg-warning-solid',
    danger: 'bg-danger-solid',
    info: 'bg-info-solid',
};

interface StatusBadgeProps {
    variant?: StatusVariant;
    /** Optional leading icon; render it at `size-3`. */
    icon?: ReactNode;
    className?: string;
    /** The label. Required - it is the non-color cue. */
    children: ReactNode;
}

export function StatusBadge({
    variant = 'neutral',
    icon,
    className,
    children,
}: StatusBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
                surface[variant],
                className,
            )}>
            <span
                aria-hidden
                className={cn('size-2 shrink-0 rounded-full', dot[variant])}
            />
            {icon}
            {children}
        </span>
    );
}
