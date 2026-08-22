/**
 * Loading skeleton for the operator onboarding card (`/onboarding`). Mirrors the
 * real `OnboardingForm` shadcn `Card` exactly: the same wrapper (`rounded-lg`,
 * `ring-1 ring-foreground/5`, `py-8`, `gap-8`), the step-pills + title header
 * (`px-8`, `space-y-6`), the `FieldGroup` (`gap-10`) with the Business Identity
 * step's field layout (full-width name, a 2-up country/city row, full-width
 * phone - each an `h-10` underline input), and the `justify-between` footer, so
 * the streamed form hydrates with no layout shift.
 */
export default function OnboardingSkeleton() {
    return (
        <div className='mx-auto flex w-full flex-col gap-8 overflow-hidden rounded-lg bg-card py-8 shadow-sm ring-1 ring-foreground/5'>
            {/* Header: step pills + divider, then title + description. */}
            <div className='space-y-6 px-8'>
                <div className='flex items-center gap-3'>
                    <div className='h-7 w-32 animate-pulse rounded-lg bg-muted' />
                    <div className='h-px w-8 bg-n-800' />
                    <div className='h-7 w-28 animate-pulse rounded-lg bg-muted opacity-50' />
                </div>
                <div className='space-y-1.5'>
                    <div className='h-6 w-48 animate-pulse rounded-md bg-muted' />
                    <div className='h-4 w-64 max-w-full animate-pulse rounded-md bg-muted' />
                </div>
            </div>

            {/* Content: FieldGroup (~gap-10, nearest on-scale step) - full name, 2-up country/city, full phone. */}
            <div className='px-8'>
                <div className='flex w-full flex-col gap-8'>
                    <FieldSkeleton />
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <FieldSkeleton />
                        <FieldSkeleton />
                    </div>
                    <FieldSkeleton />
                </div>
            </div>

            {/* Footer: Back + Continue (no border; matches CardFooter default). */}
            <div className='mt-2 flex justify-between gap-4 px-8'>
                <div className='h-9 w-20 animate-pulse rounded-md bg-muted' />
                <div className='h-9 w-28 animate-pulse rounded-md bg-muted' />
            </div>
        </div>
    );
}

/** One vertical field: label + `h-10` underline input (mirrors ui/Field + Input). */
function FieldSkeleton() {
    return (
        <div className='flex w-full flex-col gap-3'>
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
            <div className='flex h-10 items-center border-b border-input'>
                <div className='h-4 w-32 animate-pulse rounded bg-muted/60' />
            </div>
        </div>
    );
}
