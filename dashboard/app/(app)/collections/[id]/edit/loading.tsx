import { EntityEditSkeleton } from '@/components/common/entity-edit-skeleton';

/**
 * Without this the nearest boundary was the generic `(app)/loading.tsx`, so
 * opening an editor crossed three different shapes before settling. This is the
 * same skeleton the view itself shows while its entity loads.
 */
export default function EditLoading() {
  return <EntityEditSkeleton />;
}
