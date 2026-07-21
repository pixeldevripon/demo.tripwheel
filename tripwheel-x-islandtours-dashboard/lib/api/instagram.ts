import type {
  CreateInstagramPostPayload,
  InstagramAccount,
  InstagramPost,
  ReorderInstagramPostsPayload,
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
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getPosts(): Promise<InstagramPost[]> {
    return apiFetch<InstagramPost[]>('/instagram/posts');
  },
  createPost(payload: CreateInstagramPostPayload): Promise<InstagramPost> {
    return apiFetch<InstagramPost>('/instagram/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
