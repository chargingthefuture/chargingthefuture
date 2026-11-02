// Where a Today link goes on Android: the four features the app carries, and the puzzle of the day,
// open in the app; every other address opens its web page in a browser panel over the app.

import { openWebPage } from '../../../navigation/openWebPage';
import type { FeatureKey } from '../../../navigation/screens';

const IN_APP: Record<string, FeatureKey> = {
  '/apps/chyme': 'chyme',
  '/apps/beacon': 'beacon',
  '/apps/peer-programming': 'peer-programming',
  '/apps/foundation': 'foundation',
  '/games': 'games',
};

export function openTodayLink(href: string, open: (_key: FeatureKey) => void) {
  const path = href.split('?')[0];
  const key = IN_APP[path];
  if (key) {
    open(key);
    return;
  }
  void openWebPage(href, 'se-frame');
}
