const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'imf_web_token';
const USER_KEY = 'imf_web_user';

export type WebUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  zoneId?: string | null;
  zone?: { id: string; code: string; name: string } | null;
};

export function getApiUrl() {
  return API_URL;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): WebUser | null {
  if (typeof window === 'undefined') return null;
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebUser;
  } catch {
    return null;
  }
}

function setSession(token: string, user: WebUser, persist = true) {
  clearSession();
  const store = persist ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(formatApiErrorMessage(status, body));
    this.status = status;
    this.body = body;
  }
}

function formatApiErrorMessage(status: number, body: unknown): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (!body || typeof body !== 'object') return `Erreur HTTP ${status}`;

  const root = body as {
    message?: unknown;
    issues?: unknown;
  };

  const fromIssues = (issues: unknown): string | null => {
    if (!Array.isArray(issues) || issues.length === 0) return null;
    const parts = issues
      .map((issue) => {
        if (!issue || typeof issue !== 'object') return null;
        const row = issue as { message?: unknown; path?: unknown };
        const msg = typeof row.message === 'string' ? row.message : null;
        if (!msg) return null;
        const path = Array.isArray(row.path)
          ? row.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.')
          : '';
        return path ? `${path}: ${msg}` : msg;
      })
      .filter(Boolean);
    return parts.length ? parts.slice(0, 3).join(' · ') : null;
  };

  if (typeof root.message === 'string' && root.message.trim()) {
    const nested = fromIssues(root.issues);
    return nested ? `${root.message} — ${nested}` : root.message;
  }

  if (Array.isArray(root.message)) {
    return root.message.map(String).join(', ');
  }

  if (root.message && typeof root.message === 'object') {
    const nested = root.message as { message?: unknown; issues?: unknown };
    const nestedIssues = fromIssues(nested.issues) ?? fromIssues(root.issues);
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nestedIssues ? `${nested.message} — ${nestedIssues}` : nested.message;
    }
    if (nestedIssues) return nestedIssues;
  }

  const issues = fromIssues(root.issues);
  if (issues) return issues;

  return `Erreur HTTP ${status}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export async function login(
  email: string,
  password: string,
  remember = true,
) {
  const data = await apiFetch<{ accessToken: string; user: WebUser }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  setSession(data.accessToken, data.user, remember);
  return data.user;
}
