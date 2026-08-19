import type {
  InstagramAccount,
  InstagramConnection,
  InstagramCredentialStatus,
  InstagramPost,
  InstagramSyncResult,
  ReorderInstagramPostsPayload,
  SaveInstagramCredentialsPayload,
  UpdateInstagramAccountPayload,
  UpdateInstagramPostPayload,
} from '@/types/instagram';
import { apiFetch } from './fetch';

/**
 * The brand Instagram grid. Reads need VIEW_SETTINGS, writes MANAGE_SETTINGS.
 * Every mutation here busts the public `instagram` cache tag through
 * `apiFetch` (see cache-revalidation.ts).
 */
export const instagramApi = {
  getAccount(): Promise<InstagramAccount> {
    return apiFetch<InstagramAccount>('/instagram/account');
  },
  updateAccount(
    payload: UpdateInstagramAccountPayload,
  ): Promise<InstagramAccount> {
    return apiFetch<InstagramAccount>('/instagram/account', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Credential (dashboard-entered access token) ───────────────────────────
  getCredentials(): Promise<InstagramCredentialStatus> {
    return apiFetch<InstagramCredentialStatus>('/instagram/credentials');
  },
  saveCredentials(
    payload: SaveInstagramCredentialsPayload,
  ): Promise<InstagramCredentialStatus> {
    return apiFetch<InstagramCredentialStatus>('/instagram/credentials', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Connection (token status + manual sync) ───────────────────────────────
  getConnection(): Promise<InstagramConnection> {
    return apiFetch<InstagramConnection>('/instagram/connection');
  },
  sync(): Promise<InstagramSyncResult> {
    return apiFetch<InstagramSyncResult>('/instagram/sync', { method: 'POST' });
  },

  // ── Tiles (curation only) ─────────────────────────────────────────────────
  getPosts(): Promise<InstagramPost[]> {
    return apiFetch<InstagramPost[]>('/instagram/posts');
  },
  updatePost(
    id: string,
    payload: UpdateInstagramPostPayload,
  ): Promise<InstagramPost> {
    return apiFetch<InstagramPost>(`/instagram/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  reorderPosts(payload: ReorderInstagramPostsPayload): Promise<InstagramPost[]> {
    return apiFetch<InstagramPost[]>('/instagram/posts/reorder', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deletePost(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/instagram/posts/${id}`, {
      method: 'DELETE',
    });
  },
};
