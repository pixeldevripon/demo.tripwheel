'use client';

import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/lib/api/trips';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
 * Tour picker scoped to a collection's destination. MANUAL members must belong to the
 * collection's destination (the backend re-validates), so this fetches the admin tour
 * list and filters it client-side by `destinationId`.
 */
export function CollectionTourSelect({
  destinationId,
  value,
  onChange,
  excludeIds = [],
  disabled,
  placeholder = 'Select a tour',
}: CollectionTourSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['collection-tour-options', destinationId] as const,
    queryFn: () => tripsApi.getAdminTrips({ limit: 200 }),
    enabled: !!destinationId,
  });

  const tours = (data?.data ?? []).filter((t) => t.destinationId === destinationId);
  const exclude = new Set(excludeIds.filter((id) => id !== value));
  const options = tours.filter((t) => !exclude.has(t.id));

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? 'Loading tours...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No tours in this destination.
          </div>
        ) : (
          options.map((tour) => (
            <SelectItem key={tour.id} value={tour.id}>
              {tour.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
