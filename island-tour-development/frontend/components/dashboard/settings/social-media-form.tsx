'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSocialMedia, useUpdateSocialMedia } from '@/hooks/settings/use-settings';
import { SettingsCard, SettingsCardSkeleton, TextField } from './settings-fields';

const schema = z.object({
  facebookUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SocialMediaForm() {
  const { data, isLoading } = useSocialMedia();
  const { mutate, isPending } = useUpdateSocialMedia();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { facebookUrl: '', twitterUrl: '', linkedinUrl: '', instagramUrl: '' },
  });

  useEffect(() => {
    if (data) {
      reset({
        facebookUrl: data.facebookUrl ?? '',
        twitterUrl: data.twitterUrl ?? '',
        linkedinUrl: data.linkedinUrl ?? '',
        instagramUrl: data.instagramUrl ?? '',
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Social Media"
      description="Platform-wide social links shown in the public site footer."
      onSubmit={handleSubmit((v) => mutate(v))}
      isSaving={isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Facebook URL" registration={register('facebookUrl')} error={errors.facebookUrl?.message} placeholder="https://facebook.com/islandtours" />
        <TextField label="Instagram URL" registration={register('instagramUrl')} error={errors.instagramUrl?.message} placeholder="https://instagram.com/islandtours" />
        <TextField label="Twitter / X URL" registration={register('twitterUrl')} error={errors.twitterUrl?.message} placeholder="https://x.com/islandtours" />
        <TextField label="LinkedIn URL" registration={register('linkedinUrl')} error={errors.linkedinUrl?.message} placeholder="https://linkedin.com/company/islandtours" />
      </div>
    </SettingsCard>
  );
}
