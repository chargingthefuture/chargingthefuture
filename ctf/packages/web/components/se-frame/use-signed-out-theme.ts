'use client';

import { seSignedOutTheme } from '@ctf/shared';

// The theme of every signed-out screen: burgundy, light (owner decision, 2026-11-15: light is the
// default signed out, whatever the device is set to).
export function useSignedOutTheme() {
  return seSignedOutTheme(false);
}
