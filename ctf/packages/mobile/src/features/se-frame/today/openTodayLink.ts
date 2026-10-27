// Where a Today link goes on Android: the four features the app carries open in the app; every
// other address opens the web page in the browser, as the rest of the app already does.

import { Linking } from 'react-native';
import { getApiBaseUrl } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';

const IN_APP: Record<string, FeatureKey> = {
  '/apps/chyme': 'chyme',
  '/apps/beacon': 'beacon',
  '/apps/peer-programming': 'peer-programming',
  '/apps/foundation': 'foundation',
};

export function openTodayLink(href: string, open: (_key: FeatureKey) => void) {
  const path = href.split('?')[0];
  const key = IN_APP[path];
  if (key) {
    open(key);
    return;
  }
  const url = href.startsWith('http') ? href : `${getApiBaseUrl()}${href}`;
  void Linking.openURL(url);
}
