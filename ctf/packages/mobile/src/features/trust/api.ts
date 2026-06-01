import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (__DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  const Config = require('react-native-config').default;
  return (Config?.API_BASE_URL as string | undefined) ?? 'https://api.example.com';
};

export type TrustStatus = 'unverified' | 'verified' | 'flagged';
export type TrustVisibility = 'public' | 'private' | 'restricted';

export interface TrustEvidenceItem {
  type: string;
  summary: string;
  details?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TrustUserExtension {
  userId: string;
  trustStatus: TrustStatus;
  trustEvidence: TrustEvidenceItem[];
  trustVisibility: TrustVisibility;
  updatedAt: string;
}

export async function fetchTrustSelf(): Promise<TrustUserExtension> {
  const res = await fetch(`${getApiBaseUrl()}/api/trust/user/self`);
  if (!res.ok) throw new Error('Failed to fetch trust data');
  return res.json() as Promise<TrustUserExtension>;
}
