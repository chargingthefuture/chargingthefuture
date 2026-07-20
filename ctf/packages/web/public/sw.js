/* Charging The Future service worker (issue #808 task 5).
 *
 * Minimal and dependency-free on purpose: its only job is Web Push for the Foundation instant-call ring.
 * It shows a notification when a push arrives and focuses (or opens) the app at the call when the
 * notification is clicked. It does not cache or intercept fetches.
 *
 * The push payload shape (set by lib/notifications/push.ts):
 *   { title, body, data: { type, callId, url } }
 * For an instant-call ring, data.type is 'foundation.instant_call.ring' and data.url deep-links to the
 * Foundation app, where the existing incoming-call overlay (the in-app poll) renders the answer/decline UI.
 */

self.addEventListener('install', function () {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Take control of open clients so the first subscribe does not need a reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = { title: 'Charging The Future', body: event.data.text() };
    }
  }

  var title = payload.title || 'Charging The Future';
  var data = payload.data || {};
  var options = {
    body: payload.body || '',
    data: data,
    tag: data.callId ? 'foundation-call-' + data.callId : undefined,
    renotify: Boolean(data.callId),
    requireInteraction: data.type === 'foundation.instant_call.ring',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.url || '/apps/foundation';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];
        // If the app is already open, focus it and navigate it to the call.
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window at the call surface.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

/* Fetch pass-through (owner decision, 2026-07-20): a no-op fetch handler so this worker qualifies
 * the site as an installable PWA on Android (the install prompt wants a service worker that
 * controls the page). It does NOT cache or rewrite anything — every request goes to the network
 * unchanged — so it cannot serve out-of-date content or interfere with auth. Offline caching can be
 * added later behind an explicit policy; for now the app behaves exactly as it does without a
 * worker, plus it is installable and can receive push. */
self.addEventListener('fetch', function () {
  // Intentionally empty: no respondWith(), so the browser handles the request normally.
});
