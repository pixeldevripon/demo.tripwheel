'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { cn } from '@/lib/utils';

interface BulkActionSpinnerProps {
    bulkSelectedItems: number;
    title?: string;
    state?: string;
    className?: string;
}

/**
 * A clean, minimal, and professional bulk action spinner.
 */
const BulkActionSpinner = ({
    bulkSelectedItems,
    title = 'Processing Files',
    state = 'Processing',
    className,
}: BulkActionSpinnerProps) => {
    return (
        <div
            className={cn(
                'min-h-[50vh] flex flex-col items-center justify-center animate-in fade-in duration-500',
                className
            )}>
            <div className='relative flex flex-col items-center max-w-xs w-full'>
                {/* Minimalist Loader */}
                <div className='relative mb-6'>
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        className='h-12 w-12 animate-spin text-primary/20 stroke-[1.5px]'
                    />
                    <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='h-1.5 w-1.5 bg-primary rounded-full animate-pulse' />
                    </div>
                </div>

                {/* Text Content */}
                <div className='text-center space-y-1.5'>
                    <h3 className='text-sm font-medium tracking-tight text-foreground'>
                        {title}
                    </h3>
                    <div className='flex items-center justify-center space-x-1.5 text-xs text-muted-foreground font-medium'>
                        <span>{state}</span>
                        <span className='w-1 h-1 rounded-full bg-muted-foreground/30' />
                        <span>
                            {bulkSelectedItems}{' '}
                            {bulkSelectedItems === 1 ? 'item' : 'items'}
                        </span>
                    </div>
                </div>

                {/* Subtle Progress Bar (Indeterminate) */}
                <div className='mt-8 w-48 h-1 bg-muted rounded-full overflow-hidden relative'>
                    <div className='absolute inset-0 bg-primary/20 animate-pulse' />
                    <div className='absolute inset-0 bg-primary h-full w-1/3 rounded-full animate-[progress-slide_1.5s_infinite_ease-in-out] -left-full shadow-[0_0_10px_var(--color-primary)]' />
                </div>

                <p className='mt-4 text-2xs text-muted-foreground/60 tracking-[0.2em] font-medium'>
                    Please keep this page open
                </p>
            </div>

            <style jsx>{`
                @keyframes progress-slide {
                    0% {
                        left: -40%;
                        width: 30%;
                    }
                    50% {
                        width: 60%;
                    }
                    100% {
                        left: 110%;
                        width: 30%;
                    }
                }
            `}</style>
        </div>
    );
};

export default BulkActionSpinner;

