import { reasonText, reportError } from './report';

// What the crash screen shows: the readable reason and a reference that also goes into the report,
// so a screenshot can be tied to the Sentry event (rule 137).
export type AppFailure = { reason: string; reference: string };

type Listener = (_failure: AppFailure) => void;

let listener: Listener | null = null;

function newReference(): string {
  return `M-${Date.now().toString(36).toUpperCase()}`;
}

// Report a failure that would otherwise close the app, and return what the crash screen shows.
export function recordAppFailure(error: unknown, op: string): AppFailure {
  const reference = newReference();
  reportError(error, { area: 'app', op, extra: { reference } });
  return { reason: reasonText(error), reference };
}

// The crash screen registers here once it is mounted. Until then a fatal error falls through to the
// default handler, which closes the app — there is nothing on screen yet to show the reason with.
export function onAppFailure(next: Listener | null): void {
  listener = next;
}

// A fatal JavaScript error in a release build closes the app with nothing on screen, and a member on a
// phone has no way to read the device log afterwards. This handler shows the reason instead. Install
// it after Sentry so it runs first; it reports through `reportError`, which sends to Sentry itself.
export function installCrashScreenHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    if (!isFatal || !listener) {
      previous(error, isFatal);
      return;
    }
    listener(recordAppFailure(error, 'fatal_js_error'));
  });
}

type GlobalHandler = (_error: unknown, _isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (_handler: GlobalHandler) => void;
};
