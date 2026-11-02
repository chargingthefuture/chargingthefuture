// Opens a page of the web app in a browser panel over the Android app (Chrome Custom Tabs through
// expo-web-browser), so a member stays in the app and closing the panel brings them back. A path
// ("/apps/directory") is a page of this app's web, opened signed in as the same member through a
// one-time link from POST /api/account/web-sign-in; without one (signed out, not yet approved, the
// server unreachable) the page opens as it is and asks for sign-in itself. A full address opens as
// given. If the panel cannot open, the phone's browser opens the page instead.

import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { authedFetch, getApiBaseUrl } from '../auth/authedFetch';
import { reportError } from '../observability/report';

export function webPageUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${getApiBaseUrl()}${pathOrUrl}`;
}

// The page's address with a one-time sign-in link in front of it, or the plain address.
async function signedInUrl(path: string): Promise<string> {
  try {
    const res = await authedFetch('/api/account/web-sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ next: path }),
    });
    const body = (await res.json().catch(() => null)) as { path?: unknown } | null;
    if (res.ok && typeof body?.path === 'string' && body.path.startsWith('/')) return webPageUrl(body.path);
  } catch {
    // Signed out or the server unreachable: the page opens plainly and asks for sign-in itself.
    return webPageUrl(path);
  }
  return webPageUrl(path);
}

export async function openWebPage(pathOrUrl: string, area = 'navigation'): Promise<void> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : await signedInUrl(pathOrUrl);
  try {
    await WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: true });
  } catch (panelError) {
    reportError(panelError, { area, op: 'open_web_page_panel' });
    await Linking.openURL(url);
  }
}
