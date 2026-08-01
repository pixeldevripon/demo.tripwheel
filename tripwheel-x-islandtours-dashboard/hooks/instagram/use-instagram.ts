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

/**
 * Remove the stored access token, which TAKES THE PUBLIC SECTION DOWN.
 *
 * Its own hook rather than `useSaveInstagramCredentials({ accessToken: '' })`
 * from a call site, for two reasons:
 *
 * 1. There was no way to do this at all. The token field is write-only and
 *    resets to `''`, so RHF un-dirties it the moment a user clears it back to
 *    that default - `dirtyFields.accessToken` is false and the settings form
 *    skips the write. A stored token could be REPLACED but never REMOVED.
 * 2. Removing is not saving. It ends the connection (the backend nulls
 *    igUserId, the refreshed token, the expiry and the last-sync state) and the
 *    public grid stops rendering, so it deserves its own wording rather than
 *    "Instagram access token saved".
 *
 * `posts` is invalidated too. The tiles themselves survive - they are rows in
 * our database, not Instagram's - but the dashboard list labels which of them
 * reach the page, and after this none of them do.
 *
 * `account` as well, because the backend now clears the resolved handle with the
 * token (it belongs to the account the token authenticated, and is not a setting
 * anyone typed). Without this the panel kept the old @handle on screen until a
 * reload - reading as though we were still connected to it.
 *
 * Safe HERE specifically, and not in `useSaveInstagramCredentials`: this button
 * stands alone, whereas that one runs inside the settings form, which PATCHes
 * the account immediately afterwards. Invalidating `account` there raced that
 * write - see the note on that hook - and it needs no fix anyway, since the
 * PATCH's own success invalidates `account` once the write has landed.
 */
export function useRemoveInstagramCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => instagramApi.saveCredentials({ accessToken: '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramKeys.credentials() });
      qc.invalidateQueries({ queryKey: instagramKeys.connection() });
      qc.invalidateQueries({ queryKey: instagramKeys.posts() });
      qc.invalidateQueries({ queryKey: instagramKeys.account() });
      toast.success('Access token removed. The Instagram section is now hidden.');
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
