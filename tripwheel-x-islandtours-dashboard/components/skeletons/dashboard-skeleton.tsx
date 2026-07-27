import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-svh w-full bg-shell-content">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-72 flex-col bg-card border-r border-border/50">
        <div className="p-6">
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="flex-1 px-4 space-y-4 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border/50 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-16 opacity-70" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Skeleton */}
        <header className="h-[70px] bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5 md:hidden" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32 hidden sm:block" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </header>

        {/* Content Area Skeleton */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <div className="w-full space-y-8">
            {/* Page Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64 opacity-70" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-28 rounded-xl" />
                <Skeleton className="h-10 w-28 rounded-xl" />
              </div>
            </div>

            {/* Grid Content pulses */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-8 space-y-8">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
              <div className="col-span-12 lg:col-span-4 space-y-8">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
