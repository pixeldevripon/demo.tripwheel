'use client';

import { useAdminTrips } from '@/hooks/trips/use-trips';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { tourPerfSummary } from '@/lib/tours/signals';

interface CollectionTourSelectProps {
  destinationId: string;
  value: string;
  onChange: (tourId: string) => void;
  /** Tour IDs already used elsewhere (hidden from the list, except the current value). */
  excludeIds?: string[];
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Tour picker scoped to a collection's destination. Shares the admin tour list
 * query (same key as the Tours editor, so it fetches once) and surfaces each
 * tour's performance signals + badge in the option so the admin can judge *why*
 * to pick it, not just its name.
 */
export function CollectionTourSelect({
  destinationId,
  value,
  onChange,
  excludeIds = [],
  disabled,
  placeholder = 'Select a tour',
}: CollectionTourSelectProps) {
  const { data, isLoading } = useAdminTrips({ limit: 200 }, !!destinationId);

  const tours = (data?.data ?? []).filter((t) => t.destinationId === destinationId);
  const exclude = new Set(excludeIds.filter((id) => id !== value));
  const options = tours.filter((t) => !exclude.has(t.id));
  const selected = tours.find((t) => t.id === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      {/* Trigger shows the name only — the performance summary lives in the open
          options and in the strip below, so it is never rendered twice. */}
      <SelectTrigger>
        <span className={selected ? 'truncate' : 'truncate text-muted-foreground'}>
          {selected ? selected.name : isLoading ? 'Loading tours...' : placeholder}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80 w-(--radix-select-trigger-width)">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No tours in this destination.
          </div>
        ) : (
          options.map((tour) => (
            <SelectItem key={tour.id} value={tour.id} textValue={tour.name}>
              <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{tour.name}</span>
                  <TourBadgeChip type={deriveTourBadge(tour)} />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {tourPerfSummary(tour)}
                </span>
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
