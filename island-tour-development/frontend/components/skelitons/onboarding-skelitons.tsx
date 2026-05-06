export default function OnboardingSkeleton() {
    return (
        <div className='w-full border border-border bg-card shadow-sm rounded-2xl overflow-hidden'>
            <div className='p-6 space-y-6'>
                {/* Step Indicators Skeleton */}
                <div className='flex items-center gap-3'>
                    <div className='h-8 w-32 bg-muted animate-pulse rounded-lg' />
                    <div className='w-8 h-px bg-muted' />
                    <div className='h-8 w-32 bg-muted animate-pulse rounded-lg opacity-50' />
                </div>

                {/* Title & Description Skeleton */}
                <div className='space-y-3'>
                    <div className='h-7 w-48 bg-muted animate-pulse rounded-md' />
                    <div className='h-4 w-64 bg-muted animate-pulse rounded-md' />
                </div>

                {/* Form Fields Skeleton */}
                <div className='space-y-6 pt-4'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className='space-y-2'>
                                <div className='h-4 w-20 bg-muted animate-pulse rounded' />
                                <div className='h-11 w-full bg-muted/50 animate-pulse rounded-xl border border-border/50' />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Buttons Skeleton */}
            <div className='p-6 pt-2 border-t border-border/50 flex justify-between gap-4'>
                <div className='h-10 w-24 bg-muted animate-pulse rounded-lg' />
                <div className='h-10 w-32 bg-muted animate-pulse rounded-lg' />
            </div>
        </div>
    );
}

