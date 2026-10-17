import { reportError } from 'lib/observability/report';

// Signing out turns off this browser's notifications for the member who signed out (issue #2908).
// Most sign-outs go through the provider's own account menu, which runs after the session is gone, so
// the server cannot be asked to remove the row at that point. Instead the browser's own subscription is
// cancelled: the push service then answers the next send with 404/410 and sendWebPushToUser deletes the
// row. Best effort and silent: a browser without push support, or with no subscription, does nothing.
export async function dropBrowserPushWhenSignedOut(
  nav: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<boolean> {
  if (!nav?.serviceWorker) return false;
  try {
    const registration = await nav.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (!subscription) return false;
    return await subscription.unsubscribe();
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'drop_browser_push_signed_out' });
    return false;
  }
}
