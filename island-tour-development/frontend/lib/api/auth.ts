const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';

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
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  // For social-login users who don't have a password yet
  setPassword(newPassword: string): Promise<void> {
    return apiFetch('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
};
