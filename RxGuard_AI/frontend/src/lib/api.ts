import { Platform } from 'react-native';
import { storage, KEYS } from './storage';

// Portable API base. Judges run frontend and backend on the same laptop, so
// localhost:3001 is the correct default. When the exported web app is served
// directly by the backend (same origin), relative /api is used automatically.
// Override with EXPO_PUBLIC_API_URL for custom networks or hosted demos.
function getApiBase(): string {
  if (Platform.OS !== 'web') return 'http://localhost:3001/api';
  if (typeof window !== 'undefined' && window.location.port === '3001') {
    return '/api';
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
}

export const API_BASE = getApiBase();

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (token) storage.set(KEYS.token, token);
  else storage.remove(KEYS.token);
}

export function getToken(): string | null {
  if (!authToken) authToken = storage.get(KEYS.token);
  return authToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the RxGuard server. Please check your connection and try again.', 0);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired or invalid - clear stored credentials
      setToken(null);
      storage.remove(KEYS.user);
    }
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status);
  }

  if (data === null) {
    throw new ApiError('Unexpected response from server. Please try again.', 0);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form, true),
};

export function imageUrl(prescriptionId: string): string {
  const token = getToken();
  return `${API_BASE}/prescriptions/patient/${prescriptionId}/image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
