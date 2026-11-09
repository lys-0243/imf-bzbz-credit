import { Platform } from 'react-native';
import { API_URL } from './config';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'imf_access_token';

// SecureStore n'existe pas sur le web : on se rabat sur localStorage.
const isWeb = Platform.OS === 'web';

export async function getToken() {
  if (isWeb) return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (isWeb) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
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
