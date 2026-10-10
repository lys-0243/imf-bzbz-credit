import { API_URL } from './config';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'imf_access_token';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    if (typeof data?.message === 'string') msg = data.message;
    else if (Array.isArray(data?.message)) msg = data.message.join(', ');
    else if (data?.issues) msg = JSON.stringify(data.issues);
    throw new Error(msg);
  }
  return data as T;
}
