import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
    return (
        <div className='max-w-7xl space-y-8 pb-10'>
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            <div className='grid grid-cols-12 gap-8'>
                {/* Left Column */}
                <div className='col-span-12 lg:col-span-8 space-y-8'>
                    {/* Photo Card Skeleton */}
                    <div className="p-6 rounded-xl border border-border bg-card space-y-6">
                        <div className="flex items-center gap-6">
                            <Skeleton className="h-28 w-28 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-40" />
                                <Skeleton className="h-4 w-60" />
                            </div>
                        </div>
                    </div>

                    {/* Personal Info Skeleton */}
                    <div className="p-6 rounded-xl border border-border bg-card space-y-6">
                        <Skeleton className="h-8 w-48" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className='col-span-12 lg:col-span-4 space-y-8'>
                    <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
