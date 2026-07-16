import type { ProfileFormValues } from '@/lib/validations/profile';
import type {
  OperatorSocialMedia,
  SocialMediaPayload,
  UpdateProfilePayload,
  UserProfile,
} from '@/types/profile';

import { apiFetch } from './fetch';

export const profileApi = {
  async getProfile(): Promise<UserProfile> {
    const user = await apiFetch<UserProfile>('/users/me');
    const opId = user.operator?.id;

    if ((user.role === 'TOUR_OPERATOR' || user.role === 'ADMIN') && opId) {
      const [companyRes, socialRes] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/operators/${opId}/company-info`).catch(() => null),
        apiFetch<OperatorSocialMedia>(`/operators/${opId}/social-media`).catch(() => null),
      ]);
      user.operator = { id: opId, ...user.operator, companyInfo: companyRes, socialMedia: socialRes };
    }

    if (user.role === 'ADMIN') {
      const adminSocial = await apiFetch<OperatorSocialMedia>('/settings/social-media').catch(() => null);
      user.operator = { id: user.operator?.id ?? '', ...user.operator, socialMedia: adminSocial };
    }

    return user;
  },

  updateProfile(data: UpdateProfilePayload): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateOperatorSocialMedia(operatorId: string, data: SocialMediaPayload): Promise<unknown> {
    return apiFetch(`/operators/${operatorId}/social-media`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateAdminSocialMedia(data: SocialMediaPayload): Promise<unknown> {
    return apiFetch('/settings/social-media', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateAll(data: ProfileFormValues, role: string, operatorId?: string): Promise<void> {
    const profilePayload: UpdateProfilePayload = {
      name: data.name,
      phone: data.phone ?? null,
      location: data.location ?? null,
      timezone: data.timezone,
    };
    const socialPayload: SocialMediaPayload = {
      facebookUrl: data.facebookUrl,
      twitterUrl: data.twitterUrl,
      linkedinUrl: data.linkedinUrl,
      instagramUrl: data.instagramUrl,
    };

    const calls: Promise<unknown>[] = [profileApi.updateProfile(profilePayload)];
    if (role === 'ADMIN') {
      calls.push(profileApi.updateAdminSocialMedia(socialPayload));
    } else if (role === 'TOUR_OPERATOR' && operatorId) {
      calls.push(profileApi.updateOperatorSocialMedia(operatorId, socialPayload));
    }

    await Promise.all(calls);
  },
};
