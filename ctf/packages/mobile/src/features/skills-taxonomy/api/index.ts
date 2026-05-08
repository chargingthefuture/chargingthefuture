// API client for Skills Taxonomy plugin (mobile)
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

const BASE_URL = Platform.select({
  web: '/api/skills-taxonomy',
  default: `${API_BASE}/api/skills-taxonomy`,
});

type FetchOptions = RequestInit & { headers?: Record<string, string> };
async function fetchJson(path: string, options: FetchOptions = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const SkillsTaxonomyApi = {
  async getHierarchy() {
    return fetchJson('/hierarchy');
  },
  async getFlattened() {
    return fetchJson('/flattened');
  },
  async createSector(data) {
    return fetchJson('/admin/sectors', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateSector(id, data) {
    return fetchJson(`/admin/sectors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteSector(id, reason) {
    return fetchJson(`/admin/sectors/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
  },
  // Add job title/skill CRUD as needed
};
