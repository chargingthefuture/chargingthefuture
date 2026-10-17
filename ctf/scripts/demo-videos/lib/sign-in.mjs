// Signs the recording browser in as the demo account, without a password.
//
// Clerk issues a one-time sign-in token for a user id (its Backend API, with CLERK_SECRET_KEY). The
// browser opens a public page of the app, and the Clerk script the app already loads there signs in
// with that token. The Account Portal is not used: it never returned a headless browser to the app.
// The session cookies are saved and handed to every recording, so no clip shows a sign-in screen.
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

export async function signInDemoAccount(browser, { appUrl, storageFile, screenshotFile }) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const userId = process.env.DEMO_VIDEO_CLERK_USER_ID;
  if (!secretKey || !userId) {
    const missing = [
      !secretKey && 'CLERK_SECRET_KEY (a GitHub secret, or Infisical)',
      !userId && 'the demo account\'s Clerk user id (the demo_user_id box, or the DEMO_VIDEO_CLERK_USER_ID / DEMO_VIDEO_CLERK_ADMIN_ID repository variable)',
    ].filter(Boolean);
    throw new Error(`Signing in needs ${missing.join(' and ')}, and the run had none set. README, "Setting up the demo account".`);
  }
  const { token } = await createSignInToken(secretKey, userId);

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${appUrl}/guide`);
    await page.waitForFunction(() => window.Clerk?.loaded, null, { timeout: 60_000 });
    const result = await page.evaluate(async (ticket) => {
      const clerk = window.Clerk;
      try {
        const signIn = await clerk.client.signIn.create({ strategy: 'ticket', ticket });
        if (signIn.status !== 'complete') return { error: `Clerk left the sign-in at status "${signIn.status}"` };
        await clerk.setActive({ session: signIn.createdSessionId });
        return { userId: clerk.user?.id ?? null };
      } catch (error) {
        const detail = error?.errors?.map((e) => e.longMessage || e.message).join('; ');
        return { error: detail || error?.message || String(error) };
      }
    }, token);
    if (result.error) throw new Error(result.error);
    if (result.userId !== userId) throw new Error('Clerk finished the sign-in but reports a different user.');
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
  } catch (error) {
    if (screenshotFile) {
      await page.screenshot({ path: screenshotFile }).catch((shotError) => {
        console.error(`Could not save the sign-in screenshot: ${shotError.message}`);
      });
    }
    await context.close();
    throw new Error(`Signing in as the demo account failed at ${page.url()}: ${error.message}`);
  }
  await context.storageState({ path: storageFile });
  await context.close();
}
