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
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface OperatorSearchItem {
  id: string;
  isActive: boolean;
  user: { id: string; name: string; email: string };
  companyInfo: { companyName: string | null } | null;
}

export interface PaginatedOperators {
  total: number;
  page: number;
  limit: number;
  data: OperatorSearchItem[];
}

export const operatorsApi = {
  search(search: string, limit = 20): Promise<PaginatedOperators> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (search) qs.set('search', search);
    return apiFetch<PaginatedOperators>(`/operators?${qs.toString()}`);
  },
};
