import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
    return (
        <div className='mx-auto w-full max-w-5xl space-y-6 pb-8'>
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Identity card */}
            <div className="flex items-center gap-6 rounded-lg border border-line bg-card p-6">
                <Skeleton className="size-20 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
            </div>

            {/* Personal info */}
            <div className="space-y-6 rounded-lg border border-line bg-card p-6">
                <Skeleton className="h-7 w-48" />
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Security */}
            <div className="space-y-4 rounded-lg border border-line bg-card p-6">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-16 w-full" />
            </div>
        </div>
    );
}
