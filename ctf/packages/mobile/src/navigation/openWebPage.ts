// Opens a page of the web app in a browser panel over the Android app (Chrome Custom Tabs through
// expo-web-browser), so a member stays in the app and closing the panel brings them back. A path
// ("/apps/directory") is a page of this app's web; a full address opens as given. If the panel
// cannot open, the phone's browser opens the page instead.

import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getApiBaseUrl } from '../auth/authedFetch';
import { reportError } from '../observability/report';

export function webPageUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${getApiBaseUrl()}${pathOrUrl}`;
}

export async function openWebPage(pathOrUrl: string, area = 'navigation'): Promise<void> {
  const url = webPageUrl(pathOrUrl);
  try {
    await WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: true });
  } catch (panelError) {
    reportError(panelError, { area, op: 'open_web_page_panel' });
    await Linking.openURL(url);
  }
}
