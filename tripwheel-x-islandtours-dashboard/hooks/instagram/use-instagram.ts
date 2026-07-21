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

export function useCreateInstagramPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInstagramPostPayload) =>
      instagramApi.createPost(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.posts() });
      toast.success('Tile added');
    },
    onError,
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
