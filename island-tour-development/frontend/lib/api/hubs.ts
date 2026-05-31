import type {
  CreateHubPayload,
  CreateHubFaqPayload,
  HubDetail,
  HubFaq,
  HubPageContent,
  HubTranslation,
  HubsQueryParams,
  HubLocalized,
  HubAllowedCategory,
  PaginatedHubs,
  UpdateHubPayload,
  UpdateHubFaqPayload,
  UpsertHubPageContentPayload,
  UpsertHubTranslationPayload,
  Locale,
} from '@/types/hub';

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
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const hubsApi = {
  getAll(params: HubsQueryParams = {}): Promise<PaginatedHubs> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedHubs>(`/hubs${query}`);
  },

  getActive(destinationId?: string): Promise<HubLocalized[]> {
    const query = buildQuery({ destinationId: destinationId ?? undefined });
    return apiFetch<HubLocalized[]>(`/hubs/active${query}`);
  },

  getById(id: string, locale?: Locale): Promise<HubDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubDetail>(`/hubs/${id}${query}`);
  },

  getBySlug(slug: string, destinationSlug: string, locale?: Locale): Promise<HubDetail> {
    const query = buildQuery({ destinationSlug, locale: locale ?? undefined });
    return apiFetch<HubDetail>(`/hubs/slug/${slug}${query}`);
  },

  create(payload: CreateHubPayload): Promise<HubDetail> {
    return apiFetch<HubDetail>('/hubs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateHubPayload): Promise<HubDetail> {
    return apiFetch<HubDetail>(`/hubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}`, {
      method: 'DELETE',
    });
  },

  getTranslations(id: string): Promise<HubTranslation[]> {
    return apiFetch<HubTranslation[]>(`/hubs/${id}/translations`);
  },

  getTranslationByLocale(id: string, locale: Locale): Promise<HubTranslation> {
    return apiFetch<HubTranslation>(`/hubs/${id}/translations/${locale}`);
  },

  upsertTranslation(id: string, locale: Locale, payload: UpsertHubTranslationPayload): Promise<HubTranslation> {
    return apiFetch<HubTranslation>(`/hubs/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(id: string, locale: Locale): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  getPageContent(id: string, locale?: Locale): Promise<HubPageContent> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubPageContent>(`/hubs/${id}/page-content${query}`);
  },

  upsertPageContent(id: string, locale: Locale, payload: UpsertHubPageContentPayload): Promise<HubPageContent> {
    return apiFetch<HubPageContent>(`/hubs/${id}/page-content/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getFaqs(id: string, locale?: Locale): Promise<HubFaq[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubFaq[]>(`/hubs/${id}/faqs${query}`);
  },

  createFaq(id: string, payload: CreateHubFaqPayload): Promise<HubFaq> {
    return apiFetch<HubFaq>(`/hubs/${id}/faqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFaq(id: string, faqId: string, payload: UpdateHubFaqPayload): Promise<HubFaq> {
    return apiFetch<HubFaq>(`/hubs/${id}/faqs/${faqId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteFaq(id: string, faqId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  },

  getAllowedCategories(id: string): Promise<HubAllowedCategory[]> {
    return apiFetch<HubAllowedCategory[]>(`/hubs/${id}/allowed-categories`);
  },

  addAllowedCategory(id: string, categoryId: string): Promise<HubAllowedCategory> {
    return apiFetch<HubAllowedCategory>(`/hubs/${id}/allowed-categories`, {
      method: 'POST',
      body: JSON.stringify({ categoryId }),
    });
  },

  removeAllowedCategory(id: string, categoryId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/allowed-categories/${categoryId}`, {
      method: 'DELETE',
    });
  },
};
