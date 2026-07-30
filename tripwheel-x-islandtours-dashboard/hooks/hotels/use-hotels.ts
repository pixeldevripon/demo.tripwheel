'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hotelsApi } from '@/lib/api/hotels';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreateHotelPayload,
  UpdateHotelPayload,
  UpsertHotelTranslationPayload,
} from '@/types/hotel';

export const hotelKeys = {
  all: () => ['hotels'] as const,
  list: () => ['hotels', 'list'] as const,
  detail: (id: string) => ['hotels', 'detail', id] as const,
  translations: (id: string) => ['hotels', 'translations', id] as const,
};

export function useHotels() {
  return useQuery({
    queryKey: hotelKeys.list(),
    queryFn: () => hotelsApi.list(),
  });
}

export function useHotel(id: string) {
  return useQuery({
    queryKey: hotelKeys.detail(id),
    queryFn: () => hotelsApi.get(id),
    enabled: !!id,
  });
}

/**
 * Every mutation below invalidates the WHOLE `hotels` key, never just the row it
 * touched. `isPromoted` is a fact about the list, not the row: enabling hotel B
 * or clearing hotel A's photo moves the card between them, so a targeted
 * invalidation would leave two rows both claiming to be live.
 */
export function useCreateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHotelPayload) => hotelsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotelKeys.all() });
    },
  });
}

export function useUpdateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateHotelPayload;
    }) => hotelsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotelKeys.all() });
    },
  });
}

export function useDeleteHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotelKeys.all() });
    },
  });
}

export function useHotelTranslations(id: string) {
  return useQuery({
    queryKey: hotelKeys.translations(id),
    queryFn: () => hotelsApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useUpsertHotelTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      locale,
      payload,
    }: {
      locale: Locale;
      payload: UpsertHotelTranslationPayload;
    }) => hotelsApi.upsertTranslation(id, locale, payload),
    onSuccess: () => {
      // Not just the translations: the English title is part of the render gate,
      // so saving copy can change which hotel the public card shows.
      queryClient.invalidateQueries({ queryKey: hotelKeys.all() });
    },
  });
}
