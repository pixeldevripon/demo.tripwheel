import type {
  CreateCustomScriptPayload,
  CustomScript,
  ReorderCustomScriptsPayload,
  UpdateCustomScriptPayload,
} from '@/types/custom-scripts';
import { apiFetch } from './fetch';

/**
 * Admin-pasted vendor snippets injected into every public page. Reads need
 * VIEW_SETTINGS, writes MANAGE_SETTINGS.
 *
 * Every mutation here busts the public `custom-scripts` cache tag through
 * `apiFetch` (see cache-revalidation.ts). That bust matters more than most:
 * these rows render into the ROOT LAYOUT of the site, and an admin switching one
 * off is usually mid-incident.
 */
export const customScriptsApi = {
  list(): Promise<CustomScript[]> {
    return apiFetch<CustomScript[]>('/custom-scripts');
  },

  create(payload: CreateCustomScriptPayload): Promise<CustomScript> {
    return apiFetch<CustomScript>('/custom-scripts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    id: string,
    payload: UpdateCustomScriptPayload,
  ): Promise<CustomScript> {
    return apiFetch<CustomScript>(`/custom-scripts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  reorder(payload: ReorderCustomScriptsPayload): Promise<CustomScript[]> {
    return apiFetch<CustomScript[]>('/custom-scripts/reorder', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/custom-scripts/${id}`, {
      method: 'DELETE',
    });
  },
};
