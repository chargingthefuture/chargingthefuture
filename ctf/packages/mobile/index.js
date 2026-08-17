import { registerRootComponent } from 'expo';
import App from './App';
import { initMobileSentry } from './src/observability/sentry';

// Before the root component mounts, so startup crashes are captured too. No-op without a DSN.
initMobileSentry();

registerRootComponent(App);
