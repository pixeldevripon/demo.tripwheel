'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon } from '@hugeicons/core-free-icons';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLocalsFavouriteStats } from '@/hooks/locals-favourites/use-locals-favourites';
import { LocalsFavouritesListView } from './locals-favourites-list-view';

// How far from the ~30% target counts as "off track".
const COVERAGE_BAND = 10;

function CoverageBar({ pct, target }: { pct: number; target: number }) {
  const off = Math.abs(pct - target) > COVERAGE_BAND;
  return (
    <div className="relative h-2 w-full">
      {/* track + fill */}
      <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            off ? 'bg-warning-solid' : 'bg-success-solid',
          )}
          // 03 §8.3 exception: runtime-computed bar width has no class equivalent.
          // eslint-disable-next-line no-restricted-syntax
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {/* target marker */}
      <div
        className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-foreground/40"
        // 03 §8.3 exception: runtime-computed marker position has no class equivalent.
        // eslint-disable-next-line no-restricted-syntax
        style={{ left: `${Math.min(target, 100)}%` }}
        title={`Target ~${target}%`}
      />
    </div>
  );
}

export function LocalsFavouritesView() {
  const { data: stats, isLoading } = useLocalsFavouriteStats();

  return (
    <div className="space-y-6">
      <Card className="p-4">
        {isLoading || !stats ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rating/10 text-rating">
                  <HugeiconsIcon icon={StarIcon} className="size-4 fill-current" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Locals&apos; favourite coverage</p>
                  <p className="text-xs text-muted-foreground">
                    Editorial curation across live tours · target ~{stats.target}%
                  </p>
                </div>
              </div>
              <div className="text-right leading-none">
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.flagged}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}/ {stats.totalLive}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{stats.pct}% flagged</p>
              </div>
            </div>

            <CoverageBar pct={stats.pct} target={stats.target} />

            {stats.perDestination.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stats.perDestination.map((d) => (
                  <span
                    key={d.destinationId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{d.destinationName}</span>
                    <span className="font-medium tabular-nums">
                      {d.flagged}/{d.totalLive}
                    </span>
                    <span
                      className={cn(
                        'tabular-nums',
                        Math.abs(d.pct - stats.target) > COVERAGE_BAND
                          ? 'text-warning-fg'
                          : 'text-success-fg',
                      )}
                    >
                      {d.pct}%
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <LocalsFavouritesListView />
    </div>
  );
}
