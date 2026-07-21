import OnboardingSkeleton from '@/components/skeletons/onboarding-skeletons';

/**
 * Onboarding sits OUTSIDE the `(app)` group, so it never had the segment-level
 * fallback the dashboard routes get - a hard navigation here painted nothing.
 */
export default function OnboardingLoading() {
  return <OnboardingSkeleton />;
}
