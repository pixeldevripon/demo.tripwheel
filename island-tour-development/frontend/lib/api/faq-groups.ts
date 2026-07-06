import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFaqGroupPayload,
  FaqGroup,
  FaqTranslation,
  UpdateFaqGroupPayload,
  UpsertFaqTranslationPayload,
} from '@/types/faq';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message)
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Grouped-FAQ client, shared across every entity that owns FAQs. `basePath` is the
 * module segment (e.g. `/destinations`, `/categories`, `/hubs`, `/collections`);
 * `id` is the owning entity's id. Endpoint shape is identical across modules.
 */
export const faqGroupsApi = {
  list(basePath: string, id: string): Promise<FaqGroup[]> {
    return apiFetch<FaqGroup[]>(`${basePath}/${id}/faqs/groups`);
  },

  create(basePath: string, id: string, payload: CreateFaqGroupPayload): Promise<FaqGroup> {
    return apiFetch<FaqGroup>(`${basePath}/${id}/faqs/groups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    basePath: string,
    id: string,
    groupId: string,
    payload: UpdateFaqGroupPayload,
  ): Promise<FaqGroup> {
    return apiFetch<FaqGroup>(`${basePath}/${id}/faqs/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(basePath: string, id: string, groupId: string): Promise<void> {
    return apiFetch<void>(`${basePath}/${id}/faqs/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  upsertTranslation(
    basePath: string,
    id: string,
    groupId: string,
    locale: Locale,
    payload: UpsertFaqTranslationPayload,
  ): Promise<FaqTranslation> {
    return apiFetch<FaqTranslation>(
      `${basePath}/${id}/faqs/groups/${groupId}/translations/${locale}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
  },
};
