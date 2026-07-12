import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localsFavouritesApi } from '@/lib/api/locals-favourites';
import { tripKeys } from '@/hooks/trips/use-trips';

export const localsFavouriteKeys = {
  all: ['locals-favourites'] as const,
  stats: () => [...localsFavouriteKeys.all, 'stats'] as const,
};

export function useLocalsFavouriteStats() {
  return useQuery({
    queryKey: localsFavouriteKeys.stats(),
    queryFn: () => localsFavouritesApi.getStats(),
  });
}

export function useSetLocalsFavourite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tourId, value }: { tourId: string; value: boolean }) =>
      localsFavouritesApi.setForTour(tourId, value),
    onSuccess: () => {
      // Refresh the coverage counter and the admin tour list (toggle state lives
      // on each row's isLocalsFavourite).
      queryClient.invalidateQueries({ queryKey: localsFavouriteKeys.stats() });
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}
