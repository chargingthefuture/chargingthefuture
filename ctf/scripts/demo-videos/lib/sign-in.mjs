// Signs the recording browser in as the demo account, without a password.
//
// Clerk issues a one-time sign-in token for a user id (its Backend API, with CLERK_SECRET_KEY). The
// browser opens the Account Portal with that token and comes back to the app signed in; the session
// cookies are saved and handed to every recording, so no clip shows a sign-in screen.
//
// The account has to be in demo mode — its Clerk id targeted by the `demo-mode` Unleash flag — or
// the clips would show real members. The recorder checks nothing about that itself; the README's
// setup steps are where it is made true.
const CLERK_API = 'https://api.clerk.com/v1';

async function createSignInToken(secretKey, userId) {
  const response = await fetch(`${CLERK_API}/sign_in_tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Clerk refused a sign-in token for the demo account (HTTP ${response.status}): ${detail}`);
  }
  return response.json();
}

export async function signInDemoAccount(browser, { appUrl, signInUrl, storageFile }) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const userId = process.env.DEMO_VIDEO_CLERK_USER_ID;
  if (!secretKey || !userId) {
    const missing = [
      !secretKey && 'CLERK_SECRET_KEY (a GitHub secret, or Infisical)',
      !userId && 'the demo account\'s Clerk user id (the demo_user_id box, or the DEMO_VIDEO_CLERK_USER_ID secret)',
    ].filter(Boolean);
    throw new Error(`Signing in needs ${missing.join(' and ')}, and the run had none set. README, "Setting up the demo account".`);
  }
  // Clerk answers with a ready sign-in address; build one on the Account Portal if it does not.
  const { token, url: ticketUrl } = await createSignInToken(secretKey, userId);
  const url = new URL(ticketUrl || signInUrl);
  if (!url.searchParams.has('__clerk_ticket')) url.searchParams.set('__clerk_ticket', token);
  url.searchParams.set('redirect_url', `${appUrl}/`);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url.toString());
  const appHost = new URL(appUrl).host;
  try {
    await page.waitForURL((u) => u.host === appHost, { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
  } catch (error) {
    throw new Error(`Sign-in did not come back to ${appHost} within a minute; the browser was left at ${page.url()}. ${error.message}`);
  }
  await context.storageState({ path: storageFile });
  await context.close();
}
