'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { instagramApi } from '@/lib/api/instagram';
import type {
  ReorderInstagramPostsPayload,
  SaveInstagramCredentialsPayload,
  UpdateInstagramAccountPayload,
  UpdateInstagramPostPayload,
} from '@/types/instagram';

export const instagramKeys = {
  all: ['instagram'] as const,
  account: () => [...instagramKeys.all, 'account'] as const,
  credentials: () => [...instagramKeys.all, 'credentials'] as const,
  connection: () => [...instagramKeys.all, 'connection'] as const,
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

// ── Credential (dashboard-entered access token) ─────────────────────────────

export function useInstagramCredentials() {
  return useQuery({
    queryKey: instagramKeys.credentials(),
    queryFn: instagramApi.getCredentials,
  });
}

export function useSaveInstagramCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveInstagramCredentialsPayload) =>
      instagramApi.saveCredentials(payload),
    onSuccess: () => {
      // Only what a token write can actually change: the credential status
      // (masked tail) and the connection it re-seeds. NOT the whole tree - the
      // account row's layout/sync fields are untouched by this endpoint, and
      // invalidating them here raced the account PATCH that the settings form
      // sends next, so a stale GET could land after the write and leave the
      // cache showing pre-save layout.
      qc.invalidateQueries({ queryKey: instagramKeys.credentials() });
      qc.invalidateQueries({ queryKey: instagramKeys.connection() });
      toast.success('Instagram access token saved');
    },
    onError,
  });
}

// ── Connection (token status + manual sync) ─────────────────────────────────

export function useInstagramConnection() {
  return useQuery({
    queryKey: instagramKeys.connection(),
    queryFn: instagramApi.getConnection,
  });
}

/** Run a sync now; refresh both the tiles and the connection (last-sync stamp). */
export function useSyncInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => instagramApi.sync(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: instagramKeys.all });
      if (!result.ran) {
        toast.info('Nothing to sync - connect an account first.');
      } else if (result.status === 'OK') {
        toast.success(
          `Sync complete: +${result.created} new, ${result.updated} updated, ${result.removed} removed.`,
        );
      } else {
        toast.warning(
          result.error ?? `Sync finished with status ${result.status}.`,
        );
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Sync failed'),
  });
}

export function useInstagramPosts() {
  return useQuery({
    queryKey: instagramKeys.posts(),
    queryFn: instagramApi.getPosts,
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
