import { EntityEditSkeleton } from '@/components/common/entity-edit-skeleton';

/**
 * Tabbed single page - same anatomy as an entity editor (title, tab bar, form
 * card), so it reuses that skeleton.
 */
export default function SettingsLoading() {
  return <EntityEditSkeleton />;
}

