// Opens the web app's Commons home page in a browser panel over the app. The Android app has no Commons, so
// Unlock links that name the Commons open it on the web, keeping the web wording true (owner
// decisions, 2026-10-09).
import { Alert } from 'react-native';
import { openWebPage } from '../../navigation/openWebPage';
import { reportError } from '../../observability/report';

export async function openWebCommons(): Promise<void> {
  try {
    await openWebPage('/', 'unlock');
  } catch (caught) {
    reportError(caught, { area: 'unlock', op: 'open_commons' });
    Alert.alert('Unable to open', 'We could not open the Commons in your browser.');
  }
}
