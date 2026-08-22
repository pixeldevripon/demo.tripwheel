import { EntityEditSkeleton } from '@/components/common/entity-edit-skeleton';

/**
 * This route only redirects to `[id]/edit`, but that redirect is a server round
 * trip. Painting the editor's own skeleton makes the hop invisible instead of
 * flashing a generic placeholder first.
 */
export default function TourOperatorsLoading() {
  return <EntityEditSkeleton />;
}
