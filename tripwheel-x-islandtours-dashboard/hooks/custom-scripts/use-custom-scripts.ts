'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { customScriptsApi } from '@/lib/api/custom-scripts';
import type {
  CreateCustomScriptPayload,
  ReorderCustomScriptsPayload,
  UpdateCustomScriptPayload,
} from '@/types/custom-scripts';

export const customScriptKeys = {
  all: ['custom-scripts'] as const,
  list: () => [...customScriptKeys.all, 'list'] as const,
};

const onError = (err: Error) =>
  toast.error(err.message || 'Failed to save the script');

export function useCustomScripts() {
  return useQuery({
    queryKey: customScriptKeys.list(),
    queryFn: customScriptsApi.list,
  });
}

/**
 * NO `onError` toast on this one, deliberately.
 *
 * The server's rejection is the most useful thing this feature produces - "<base>
 * is not allowed", "<script> is never closed", "not valid JavaScript: Unexpected
 * token ':'". A toast puts that in the far corner of the screen, times out, and
 * leaves the admin staring at a dialog that gives no hint which of 40 pasted
 * lines is wrong. The dialog renders it against the Code field instead, so the
 * caller owns the failure. Callers WITHOUT a field to render into (the row
 * toggle) pass a per-call `onError` and get their toast back.
 */
export function useCreateCustomScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomScriptPayload) =>
      customScriptsApi.create(payload),
    onSuccess: (script) => {
      qc.invalidateQueries({ queryKey: customScriptKeys.all });
      toast.success(
        script.isActive
          ? `"${script.name}" is now live on every page`
          : `"${script.name}" saved (inactive)`,
      );
    },
  });
}

export function useUpdateCustomScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCustomScriptPayload;
    }) => customScriptsApi.update(id, payload),
    onSuccess: (script, { payload }) => {
      qc.invalidateQueries({ queryKey: customScriptKeys.all });
      // Say what actually changed on the SITE. "Saved" is the wrong word for a
      // toggle that just pulled a vendor's code off every page.
      if (payload.isActive === true) {
        toast.success(`"${script.name}" is live on every page`);
      } else if (payload.isActive === false) {
        toast.success(`"${script.name}" is off - removed from every page`);
      } else {
        toast.success(`"${script.name}" saved`);
      }
    },
    // No onError - same reason as useCreateCustomScript above. The row toggle
    // passes its own per-call handler.
  });
}

/**
 * Order is saved as one call for the whole list, matching the backend's single
 * transaction: order IS execution order, so a half-applied move could leave a
 * tag firing before the consent manager meant to gate it.
 */
export function useReorderCustomScripts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReorderCustomScriptsPayload) =>
      customScriptsApi.reorder(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customScriptKeys.all });
    },
    onError,
  });
}

export function useDeleteCustomScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customScriptsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customScriptKeys.all });
      toast.success('Script removed');
    },
    onError,
  });
}
