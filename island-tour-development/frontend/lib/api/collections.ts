import type {
  Collection,
  CollectionDetail,
  CollectionFaq,
  CollectionLocalized,
  CollectionPageContent,
  CollectionRenderTour,
  CollectionTourEntry,
  CollectionTourForEdit,
  CollectionTourRationale,
  CollectionTranslation,
  CreateCollectionFaqPayload,
  CreateCollectionPayload,
  Locale,
  ReplaceCollectionToursPayload,
  UpdateCollectionFaqPayload,
  UpdateCollectionPayload,
  UpsertCollectionPageContentPayload,
  UpsertCollectionTourRationalePayload,
  UpsertCollectionTranslationPayload,
} from '@/types/collection';
import type { CollectionStatus } from '@/types/enums';

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
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const collectionsApi = {
  // Admin
  getAllAdmin(destinationSlug: string): Promise<Collection[]> {
    return apiFetch<Collection[]>(`/collections/admin/all${buildQuery({ destinationSlug })}`);
  },
  getById(id: string): Promise<Collection> {
    return apiFetch<Collection>(`/collections/${id}`);
  },
  create(payload: CreateCollectionPayload): Promise<Collection> {
    return apiFetch<Collection>('/collections', { method: 'POST', body: JSON.stringify(payload) });
  },
  update(id: string, payload: UpdateCollectionPayload): Promise<Collection> {
    return apiFetch<Collection>(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/collections/${id}`, { method: 'DELETE' });
  },
  forceDelete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/collections/${id}/force`, { method: 'DELETE' });
  },

  // Public (reference)
  getActive(destinationSlug: string, locale?: Locale): Promise<CollectionLocalized[]> {
    return apiFetch<CollectionLocalized[]>(`/collections${buildQuery({ destinationSlug, locale })}`);
  },
  getBySlug(slug: string, destinationSlug: string, locale?: Locale): Promise<CollectionDetail> {
    return apiFetch<CollectionDetail>(`/collections/slug/${slug}${buildQuery({ destinationSlug, locale })}`);
  },

  // Translations
  getTranslations(id: string): Promise<CollectionTranslation[]> {
    return apiFetch<CollectionTranslation[]>(`/collections/${id}/translations`);
  },
  getTranslationByLocale(id: string, locale: Locale): Promise<CollectionTranslation> {
    return apiFetch<CollectionTranslation>(`/collections/${id}/translations/${locale}`);
  },
  upsertTranslation(
    id: string,
    locale: Locale,
    payload: UpsertCollectionTranslationPayload
  ): Promise<CollectionTranslation> {
    return apiFetch<CollectionTranslation>(`/collections/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deleteTranslation(id: string, locale: Locale): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/collections/${id}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Page content
  getPageContent(id: string, locale?: Locale): Promise<CollectionPageContent> {
    return apiFetch<CollectionPageContent>(`/collections/${id}/page-content${buildQuery({ locale })}`);
  },
  upsertPageContent(
    id: string,
    locale: Locale,
    payload: UpsertCollectionPageContentPayload
  ): Promise<CollectionPageContent> {
    return apiFetch<CollectionPageContent>(`/collections/${id}/page-content/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // FAQs
  getFaqs(id: string, locale?: Locale): Promise<CollectionFaq[]> {
    return apiFetch<CollectionFaq[]>(`/collections/${id}/faqs${buildQuery({ locale })}`);
  },
  createFaq(id: string, payload: CreateCollectionFaqPayload): Promise<CollectionFaq> {
    return apiFetch<CollectionFaq>(`/collections/${id}/faqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateFaq(id: string, faqId: string, payload: UpdateCollectionFaqPayload): Promise<CollectionFaq> {
    return apiFetch<CollectionFaq>(`/collections/${id}/faqs/${faqId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deleteFaq(id: string, faqId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/collections/${id}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  },

  // Status lifecycle (publish guard G5 enforced server-side → 422 on blockers)
  updateStatus(id: string, status: CollectionStatus): Promise<Collection> {
    return apiFetch<Collection>(`/collections/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // MANUAL membership + per-locale rationales for the admin Tours editor (ordered).
  getToursForEdit(id: string): Promise<CollectionTourForEdit[]> {
    return apiFetch<CollectionTourForEdit[]>(`/collections/${id}/tours`);
  },

  // Admin preview of the tours a collection resolves to (DYNAMIC filter or MANUAL order).
  getResolvedTours(id: string): Promise<CollectionRenderTour[]> {
    return apiFetch<CollectionRenderTour[]>(`/collections/${id}/resolved-tours`);
  },

  // MANUAL membership (replace-all). Re-normalizes positions 0..n; kept tours
  // keep their rationale translations, removed tours are dropped.
  replaceTours(id: string, payload: ReplaceCollectionToursPayload): Promise<CollectionTourEntry[]> {
    return apiFetch<CollectionTourEntry[]>(`/collections/${id}/tours`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Per-tour, per-locale rationale (tour must already be a member).
  upsertTourRationale(
    id: string,
    tourId: string,
    locale: Locale,
    payload: UpsertCollectionTourRationalePayload
  ): Promise<CollectionTourRationale> {
    return apiFetch<CollectionTourRationale>(
      `/collections/${id}/tours/${tourId}/rationale/${locale}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    );
  },
};
