const API_BASE = '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

let unauthorizedHandler: (() => void) | null = null;

// Called when the server rejects the stored token (expired, disabled or deleted account)
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    // Wrong credentials on the login form are a 401 too, but don't end a session
    const isCredentialCheck = path === '/auth/login' || path === '/auth/register';
    if (response.status === 401 && token && !isCredentialCheck) {
      unauthorizedHandler?.();
    }
    throw new ApiError(body.error || 'Request failed', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ApiError';
  }
}
