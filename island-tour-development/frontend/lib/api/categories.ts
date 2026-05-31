import type {
  CategoriesQueryParams,
  CategoryDetail,
  CategoryFaq,
  CategoryLocalized,
  CategoryPageContent,
  CategoryTranslation,
  CreateCategoryFaqPayload,
  CreateCategoryPayload,
  Locale,
  PaginatedCategories,
  UpdateCategoryFaqPayload,
  UpdateCategoryPayload,
  UpsertCategoryPageContentPayload,
  UpsertCategoryTranslationPayload,
} from '@/types/category';

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

export const categoriesApi = {
  getAll(params: CategoriesQueryParams = {}): Promise<PaginatedCategories> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedCategories>(`/categories${query}`);
  },

  getActive(locale?: Locale): Promise<CategoryLocalized[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<CategoryLocalized[]>(`/categories/active${query}`);
  },

  getById(id: string, locale?: Locale): Promise<CategoryDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<CategoryDetail>(`/categories/${id}${query}`);
  },

  getBySlug(slug: string, locale?: Locale): Promise<CategoryDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<CategoryDetail>(`/categories/slug/${slug}${query}`);
  },

  create(payload: CreateCategoryPayload): Promise<CategoryDetail> {
    return apiFetch<CategoryDetail>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateCategoryPayload): Promise<CategoryDetail> {
    return apiFetch<CategoryDetail>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  getTranslations(id: string): Promise<CategoryTranslation[]> {
    return apiFetch<CategoryTranslation[]>(`/categories/${id}/translations`);
  },

  getTranslationByLocale(id: string, locale: Locale): Promise<CategoryTranslation> {
    return apiFetch<CategoryTranslation>(`/categories/${id}/translations/${locale}`);
  },

  upsertTranslation(id: string, locale: Locale, payload: UpsertCategoryTranslationPayload): Promise<CategoryTranslation> {
    return apiFetch<CategoryTranslation>(`/categories/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(id: string, locale: Locale): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/categories/${id}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  getPageContent(id: string, locale?: Locale): Promise<CategoryPageContent> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<CategoryPageContent>(`/categories/${id}/page-content${query}`);
  },

  upsertPageContent(id: string, locale: Locale, payload: UpsertCategoryPageContentPayload): Promise<CategoryPageContent> {
    return apiFetch<CategoryPageContent>(`/categories/${id}/page-content/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getFaqs(id: string, locale?: Locale): Promise<CategoryFaq[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<CategoryFaq[]>(`/categories/${id}/faqs${query}`);
  },

  createFaq(id: string, payload: CreateCategoryFaqPayload): Promise<CategoryFaq> {
    return apiFetch<CategoryFaq>(`/categories/${id}/faqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFaq(id: string, faqId: string, payload: UpdateCategoryFaqPayload): Promise<CategoryFaq> {
    return apiFetch<CategoryFaq>(`/categories/${id}/faqs/${faqId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteFaq(id: string, faqId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/categories/${id}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  },

  forceDelete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/categories/${id}/force`, {
      method: 'DELETE',
    });
  },
};
