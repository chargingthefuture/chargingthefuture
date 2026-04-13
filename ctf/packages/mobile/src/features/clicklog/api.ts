
import Config from 'react-native-config';
import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (__DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  return Config.API_BASE_URL || 'https://api.example.com';
};

const API_BASE_URL = getApiBaseUrl();

async function handleResponse(res: Response, fallbackMessage: string) {
  if (!res.ok) {
    let errorMessage = fallbackMessage;
    try {
      const body = await res.json();
      if (body.error) errorMessage = body.error;
    } catch {}
    throw new Error(errorMessage);
  }
  return res.json();
}

async function getAuthToken() {
  // Replace with your actual auth token retrieval logic
  // e.g., from SecureStore, AsyncStorage, or context
  return '';
}

export async function fetchIncidents() {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/clicklog`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleResponse(res, 'Failed to fetch incidents');
}

export async function logIncident(metadata: { latitude?: number; longitude?: number; notes?: string }) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/clicklog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ metadata }),
  });
  return handleResponse(res, 'Failed to log incident');
}

export async function deleteIncident(id: string) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/clicklog/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleResponse(res, 'Failed to delete incident');
}
