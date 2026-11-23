import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionPlaces, readSessionPlace, writeSessionPlace } from './session-place-store';

// A minimal stand-in for window.sessionStorage.
function installFakeStorage() {
  const data = new Map<string, string>();
  const store = {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  vi.stubGlobal('window', { sessionStorage: store });
  return data;
}

describe('session place store', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = installFakeStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a value and removes it when written empty', () => {
    writeSessionPlace('se-draft:ask:title', 'help me find a room');
    expect(readSessionPlace('se-draft:ask:title')).toBe('help me find a room');
    writeSessionPlace('se-draft:ask:title', '');
    expect(readSessionPlace('se-draft:ask:title')).toBeNull();
  });

  it('clears drafts and the Today place on sign-out and leaves other keys alone', () => {
    data.set('se-draft:card:a:public', 'hello');
    data.set('se-today-open-card', '{"id":"a","sheet":true}');
    data.set('ctf-back-history', '[]');
    clearSessionPlaces();
    expect([...data.keys()]).toEqual(['ctf-back-history']);
  });

  it('reads null and writes nothing when the browser blocks storage', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('blocked');
      },
    });
    expect(readSessionPlace('se-draft:x')).toBeNull();
    expect(() => writeSessionPlace('se-draft:x', 'y')).not.toThrow();
    expect(() => clearSessionPlaces()).not.toThrow();
  });
});
