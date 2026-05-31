import Config from 'react-native-config';
import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (__DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  return Config.API_BASE_URL || 'https://api.example.com';
};

const API_BASE_URL = getApiBaseUrl();

export type WhatWorksProduct = {
  id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  verifiedCount: number;
  viewerHasEndorsed: boolean;
};

export type WhatWorksProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  products: WhatWorksProduct[];
};

export type WhatWorksStats = { problems: number; verifiedTools: number; survivorsHelped: number };

export type WhatWorksProblemOption = { id: string; slug: string; emoji: string; title: string; context: string };

async function handleResponse(res: Response, fallbackMessage: string) {
  if (!res.ok) {
    let errorMessage = fallbackMessage;
    try {
      const body = await res.json();
      if (body.message) errorMessage = body.message;
      else if (body.error) errorMessage = body.error;
    } catch {
      // keep fallback
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

async function getAuthToken() {
  // Replace with the real token retrieval (SecureStore / AsyncStorage / context).
  return '';
}

function authHeaders(token: string, mutation: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (mutation) {
    headers['Content-Type'] = 'application/json';
    headers['x-ctf-csrf'] = '1';
  }
  return headers;
}

export async function fetchList(): Promise<{ problems: WhatWorksProblem[]; stats: WhatWorksStats }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/whatworks`, { headers: authHeaders(token, false) });
  return handleResponse(res, 'Failed to load What Works');
}

export async function fetchProblems(): Promise<{ problems: WhatWorksProblemOption[] }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/whatworks/problems`, { headers: authHeaders(token, false) });
  return handleResponse(res, 'Failed to load problems');
}

export async function suggestProduct(input: {
  problemId: string;
  name: string;
  purchaseUrl: string;
  note?: string;
}) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/whatworks/products`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  return handleResponse(res, 'Failed to submit suggestion');
}

export async function toggleEndorsement(productId: string, endorsed: boolean): Promise<{ verifiedCount: number; viewerHasEndorsed: boolean }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/whatworks/products/${productId}/endorse`, {
    method: endorsed ? 'DELETE' : 'POST',
    headers: authHeaders(token, true),
  });
  return handleResponse(res, 'Failed to update');
}
