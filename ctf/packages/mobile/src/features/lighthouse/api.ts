import { Platform } from 'react-native';
import type { PropertiesResponse, MatchesResponse } from './types';

export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000/api/lighthouse'
  : 'http://localhost:3000/api/lighthouse';

export async function fetchProperties(page = 1, pageSize = 20): Promise<PropertiesResponse> {
  const url = `${API_BASE_URL}/properties?page=${page}&pageSize=${pageSize}&onlyActive=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Properties fetch failed: ${res.status}`);
  }
  return (await res.json()) as PropertiesResponse;
}

export async function fetchMatches(): Promise<MatchesResponse> {
  const url = `${API_BASE_URL}/matches`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Matches fetch failed: ${res.status}`);
  }
  return (await res.json()) as MatchesResponse;
}
