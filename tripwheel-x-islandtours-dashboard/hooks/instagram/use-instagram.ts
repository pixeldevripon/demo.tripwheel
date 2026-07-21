'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { instagramApi } from '@/lib/api/instagram';
import type {
  CreateInstagramPostPayload,
  ReorderInstagramPostsPayload,
  UpdateInstagramAccountPayload,
  UpdateInstagramPostPayload,
} from '@/types/instagram';

export const instagramKeys = {
  all: ['instagram'] as const,
  account: () => [...instagramKeys.all, 'account'] as const,
  posts: () => [...instagramKeys.all, 'posts'] as const,
};

const onError = (err: Error) =>
  toast.error(err.message || 'Failed to save the Instagram feed');

export function useInstagramAccount() {
  return useQuery({
    queryKey: instagramKeys.account(),
    queryFn: instagramApi.getAccount,
  });
}

export function useUpdateInstagramAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateInstagramAccountPayload) =>
      instagramApi.updateAccount(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.account() });
      toast.success('Instagram account saved');
    },
    onError,
  });
}

export function useInstagramPosts() {
  return useQuery({
    queryKey: instagramKeys.posts(),
    queryFn: instagramApi.getPosts,
  });
}

/**
 * Add tiles from one media-library pick. There is no single-tile counterpart:
 * tiles are only ever created by picking media, and picking one photo is just
 * an array of one.
 *
 * Sequential on purpose, and it must stay that way: the backend sets
 * `displayOrder` to `max(displayOrder) + 1` via a read-then-write with no lock,
 * so N parallel POSTs would all read the same max and land on the same slot -
 * the public order would then fall back to the id tiebreak instead of the order
 * the admin picked them in.
 *
 * Invalidation is in `onSettled` rather than `onSuccess`: if the run dies on
 * tile 7 of 10, six tiles really were created, and the grid has to show them.
 */
export function useCreateInstagramPosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payloads: CreateInstagramPostPayload[]) => {
      const created = [];
      for (const payload of payloads) {
        created.push(await instagramApi.createPost(payload));
      }
      return created;
    },
    onSuccess: (created) =>
      toast.success(
        created.length === 1 ? 'Tile added' : `${created.length} tiles added`,
      ),
    onError: (err: Error) =>
      toast.error(
        `${err.message || 'Failed to add the tiles'} - any tiles already added were kept.`,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: instagramKeys.posts() }),
  });
}

export function useUpdateInstagramPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateInstagramPostPayload;
    }) => instagramApi.updatePost(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.posts() });
      toast.success('Tile saved');
    },
    onError,
  });
}

/**
 * Order is saved as one call for the whole list, so a half-applied drag can
 * never leave two tiles sharing a slot.
 */
export function useReorderInstagramPosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReorderInstagramPostsPayload) =>
      instagramApi.reorderPosts(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.posts() });
    },
    onError,
  });
}

export function useDeleteInstagramPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instagramApi.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.posts() });
      toast.success('Tile removed');
    },
    onError,
  });
}
