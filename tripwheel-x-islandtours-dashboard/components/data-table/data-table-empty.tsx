import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The one empty state (03 §5.6): icon + title + explanation + optional
 * action. Ten tables used to hand-write their own.
 */
export interface DataTableEmptyProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function DataTableEmpty({
    icon: Icon,
    title,
    description,
    action,
}: DataTableEmptyProps) {
    return (
        <div className='flex flex-col items-center gap-2 py-4'>
            {Icon && (
                <Icon aria-hidden className='size-8 text-content-subtle' />
            )}
            <p className='text-sm font-medium text-content'>{title}</p>
            {description && (
                <p className='text-xs text-content-muted'>{description}</p>
            )}
            {action && <div className='mt-2'>{action}</div>}
        </div>
    );
}
