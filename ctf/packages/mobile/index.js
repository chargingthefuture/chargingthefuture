import { createElement } from 'react';
import { registerRootComponent } from 'expo';
import { initMobileSentry } from './src/observability/sentry';
import { installCrashScreenHandler, recordAppFailure } from './src/observability/crashHandler';
import { CrashGuard } from './src/observability/CrashScreen';

// Before the root component mounts, so startup crashes are captured too. No-op without a DSN.
initMobileSentry();
// After Sentry, so a fatal error shows the crash screen instead of closing the app.
installCrashScreenHandler();

// Loaded with require inside a try, not a top-level import: an import that throws while the app's
// code loads would close the app before anything could be drawn, with no reason given.
let App = null;
let initialFailure = null;
try {
  App = require('./App').default;
} catch (error) {
  initialFailure = recordAppFailure(error, 'load_app_code');
}

registerRootComponent(() => createElement(CrashGuard, { App, initialFailure }));
