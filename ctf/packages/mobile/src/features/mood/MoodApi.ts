import { Platform } from "react-native";

// Lightweight storage abstraction: prefer AsyncStorage if available, otherwise fall back to in-memory.
let AsyncStorage: any = null;
try {
  // dynamic import to avoid hard dependency
  // @ts-ignore
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch (e) {
  AsyncStorage = null;
}

const MEM_STORE: Record<string, string> = {};
const STORAGE_PREFIX = "ctf:mood:";

async function storageGet(key: string): Promise<string | null> {
  try {
    if (AsyncStorage) return await AsyncStorage.getItem(key);
  } catch (e) {
    // fallthrough
  }
  return MEM_STORE[key] ?? null;
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (AsyncStorage) return await AsyncStorage.setItem(key, value);
  } catch (e) {
    // fallthrough
  }
  MEM_STORE[key] = value;
}

function generateClientId(): string {
  // simple UUID v4-ish generator
  return "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getClientId(): Promise<string> {
  const key = STORAGE_PREFIX + "clientId";
  let id = await storageGet(key);
  if (!id) {
    id = generateClientId();
    await storageSet(key, id);
  }
  return id;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function getLastSubmissionAt(clientId: string): Promise<number | null> {
  const key = STORAGE_PREFIX + "last:" + clientId;
  const v = await storageGet(key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function canSubmit(
  clientId: string,
): Promise<{ eligible: boolean; nextAvailableAt?: number | null }> {
  const last = await getLastSubmissionAt(clientId);
  if (!last) return { eligible: true, nextAvailableAt: null };
  const now = Date.now();
  const next = last + SEVEN_DAYS_MS;
  return { eligible: now >= next, nextAvailableAt: next };
}

export async function submitMood(
  clientId: string,
  moodValue: number,
  note?: string,
): Promise<{ ok: boolean; submittedAt?: number }> {
  const { eligible } = await canSubmit(clientId);
  if (!eligible) return { ok: false };
  const now = Date.now();
  const key = STORAGE_PREFIX + "last:" + clientId;
  await storageSet(key, String(now));
  // In a full implementation this would POST to the server. For local parity we store the timestamp only.
  // Optionally store the last value for debug
  await storageSet(
    STORAGE_PREFIX + "lastValue:" + clientId,
    JSON.stringify({ moodValue, note, submittedAt: now }),
  );
  return { ok: true, submittedAt: now };
}
