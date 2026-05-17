'use client';

import { profileApi } from '@/lib/api/profile';
import type { ProfileFormValues } from '@/lib/validations/profile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useMutation({
    mutationFn: ({ data, role, operatorId }: { data: ProfileFormValues; role: string; operatorId?: string }) =>
      profileApi.updateAll(data, role, operatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
    onError: (err: Error) => toast.error(err.message || 'Update failed'),
  });
}

export function useUpdateProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: string | null) => profileApi.updateProfile({ image }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update photo'),
  });
}
