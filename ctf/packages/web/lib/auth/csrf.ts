// Same-origin CSRF check based on the host the request was actually delivered to
// (the proxied public host), NOT a build-time-configured URL. A browser sets the
// Origin header to the page's origin and cannot forge it cross-site, so requiring
// Origin's host to equal our own delivered host blocks cross-site writes while
// working on any domain the app is served on.
export type MutationOriginCheck = 'allow' | 'invalid_origin' | 'cross_origin';

export function checkMutationOrigin(request: Request): MutationOriginCheck {
  const origin = request.headers.get('origin');
  // No Origin header (e.g. the native app / non-browser clients) is not a cross-site
  // browser write; allow it, preserving the existing fail-open-on-missing-Origin behavior.
  if (!origin) return 'allow';

  // x-forwarded-host is set by the proxy (Render) to the public domain; fall back to Host.
  // It can be a comma-separated list when multiple proxies are involved — take the first.
  const forwarded = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const requestHost = forwarded.split(',')[0]?.trim() ?? '';
  // If we genuinely cannot determine our own host, preserve the prior fail-open behavior.
  if (requestHost === '') return 'allow';

  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return 'invalid_origin';
  }

  return originHost === requestHost ? 'allow' : 'cross_origin';
}
