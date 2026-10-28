import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Gift card codes are stored encrypted (AES-256-GCM) and erased when the claim is reviewed.
// CONTRIBUTIONS_CODE_KEY is a long random password kept in Infisical; its SHA-256 is the key. It is
// server-only and never logged. Unset means the app takes no codes: the form says contributions are
// paused instead of storing a code it could not protect. Changing the key leaves codes still waiting
// for review unreadable, and the admin queue says so on each one.
//
// Stored form: v1.<iv>.<tag>.<ciphertext>, each base64url. The member's account id is bound in as
// additional data, so a code copied onto another member's row does not decrypt.

const VERSION = 'v1';
const MIN_KEY_LENGTH = 32;

function readKey(): Buffer | null {
  const raw = process.env.CONTRIBUTIONS_CODE_KEY?.trim() ?? '';
  if (raw.length < MIN_KEY_LENGTH) return null;
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function codeEncryptionReady(): boolean {
  return readKey() !== null;
}

export function encryptGiftCardCode(code: string, userId: string): string {
  const key = readKey();
  if (!key) throw new Error('contributions_paused');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId, 'utf8'));
  const sealed = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), sealed.toString('base64url')].join('.');
}

export type DecryptedCode = { ok: true; code: string } | { ok: false; reason: string };

export function decryptGiftCardCode(stored: string, userId: string): DecryptedCode {
  const key = readKey();
  if (!key) return { ok: false, reason: 'CONTRIBUTIONS_CODE_KEY is not set, so no code can be read.' };
  const [version, iv, tag, sealed] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !sealed) {
    return { ok: false, reason: 'The stored code is not in a form this version of the app reads.' };
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(userId, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const code = Buffer.concat([decipher.update(Buffer.from(sealed, 'base64url')), decipher.final()]).toString('utf8');
    return { ok: true, code };
  } catch {
    return { ok: false, reason: 'The code does not decrypt with the current CONTRIBUTIONS_CODE_KEY; the key was changed after it was sent.' };
  }
}
