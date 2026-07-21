import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton';

/** Suspense boundary for this segment - reuses the page's own skeleton. */
export default function ProfileLoading() {
  return <ProfileSkeleton />;
}
