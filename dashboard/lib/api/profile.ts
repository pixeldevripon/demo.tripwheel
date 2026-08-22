import type { UpdateProfilePayload, UserProfile } from '@/types/profile';

import { apiFetch } from './fetch';

/**
 * Profile page API. Deliberately thin since the 2026-07-28 redesign: the page
 * shows name/avatar/email/account-details only, so one `/users/me` read and
 * one PATCH cover it. Operator company/social records are managed on their
 * own screens, not here.
 */
export const profileApi = {
  getProfile(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/me');
  },

  updateProfile(data: UpdateProfilePayload): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
