import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the Webflow-style profile layout: left rail + flat sections. */
export function ProfileSkeleton() {
    return (
        <div className='w-full max-w-5xl pb-16'>
            <div className='flex flex-col gap-8 lg:flex-row lg:gap-12'>
                {/* Left rail: section nav only */}
                <div className='shrink-0 lg:w-52'>
                    {/* Account, Company (admins/operators only), Security. */}
                    <div className='flex gap-1 lg:flex-col'>
                        <Skeleton className='h-9 w-28 rounded-md lg:w-full' />
                        <Skeleton className='h-9 w-28 rounded-md lg:w-full' />
                        <Skeleton className='h-9 w-28 rounded-md lg:w-full' />
                    </div>
                </div>

                {/* Content column */}
                <div className='min-w-0 flex-1'>
                    {/* Avatar block */}
                    <div className='border-b border-line pb-10'>
                        <Skeleton className='h-5 w-20' />
                        <div className='mt-5 flex items-start gap-5'>
                            <Skeleton className='size-14 shrink-0 rounded-full' />
                            <div className='space-y-2.5'>
                                <Skeleton className='h-8 w-24 rounded-md' />
                                <Skeleton className='h-4 w-64' />
                            </div>
                        </div>
                    </div>

                    {/* Account info block */}
                    <div className='border-b border-line py-10'>
                        <div className='flex items-start justify-between'>
                            <div className='space-y-2'>
                                <Skeleton className='h-5 w-28' />
                                <Skeleton className='h-4 w-64' />
                            </div>
                            <Skeleton className='h-8 w-16 rounded-md' />
                        </div>
                        <div className='mt-6 max-w-xl space-y-6'>
                            {[1, 2].map(i => (
                                <div key={i} className='space-y-2'>
                                    <Skeleton className='h-4 w-20' />
                                    <Skeleton className='h-9 w-full' />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details rows */}
                    <div className='py-10'>
                        <Skeleton className='h-5 w-32' />
                        <div className='mt-4 space-y-0'>
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className='flex items-center gap-4 border-b border-line py-3.5'>
                                    <Skeleton className='h-4 w-40' />
                                    <Skeleton className='h-4 w-32' />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
