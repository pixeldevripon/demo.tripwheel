import { WorkspaceSkeleton } from '@/components/translations/workspace/workspace-skeleton';

/**
 * Without this the segment had no loading UI, so clicking a matrix cell painted a
 * blank page until the workspace's client bundle mounted and its queries
 * resolved. The same skeleton the workspace itself shows, so the two phases read
 * as one continuous load.
 */
export default function TranslationWorkspaceLoading() {
  return <WorkspaceSkeleton />;
}
