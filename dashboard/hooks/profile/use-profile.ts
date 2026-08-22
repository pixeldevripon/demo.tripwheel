'use client';

import { profileApi } from '@/lib/api/profile';
import type { ProfileFormValues } from '@/lib/validations/profile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
};

export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => profileApi.getProfile(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: ProfileFormValues) => profileApi.updateProfile(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      // The shell (sidebar identity card, header avatar) renders from
      // server-fetched profile data - refresh so it picks up the change too.
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message || 'Update failed'),
  });
}

export function useUpdateProfilePhoto() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (image: string | null) => profileApi.updateProfile({ image }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update photo'),
  });
}
