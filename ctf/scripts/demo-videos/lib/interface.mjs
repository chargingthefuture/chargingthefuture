// Puts the demo account on one interface (3.0 or 3.1) for a run and puts it back afterwards.
//
// The interface is saved on the account, and the 3.0 and 3.1 demo clips sign in as the same demo
// accounts. So a run that needs 3.1 switches the account, records, and restores what it found. The
// two workflows share one concurrency group, so a 3.0 run never starts while the account is switched.
async function callPreferences(browser, { appUrl, storageFile }, method, body) {
  const context = await browser.newContext({ storageState: storageFile });
  const page = await context.newPage();
  try {
    await page.goto(`${appUrl}/guide`);
    return await page.evaluate(
      async ({ method, body }) => {
        const res = await fetch('/api/account/ui-preferences', {
          method,
          credentials: 'same-origin',
          headers: body ? { 'content-type': 'application/json', 'x-ctf-csrf': '1' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        return { status: res.status, json };
      },
      { method, body },
    );
  } finally {
    await context.close();
  }
}

// Returns the interface the account was on, so restoreInterface can put it back.
export async function switchInterface(browser, session, version) {
  const read = await callPreferences(browser, session, 'GET');
  if (read.status !== 200) {
    throw new Error(`Could not read the demo account's interface (HTTP ${read.status}): ${read.json?.message ?? 'no message'}`);
  }
  const previous = read.json.interfaceVersion ?? null;
  if (previous === version) return previous;
  const saved = await callPreferences(browser, session, 'PUT', { interfaceVersion: version });
  if (saved.status !== 200) {
    throw new Error(`Could not switch the demo account to ${version} (HTTP ${saved.status}): ${saved.json?.message ?? 'no message'}`);
  }
  return previous;
}

export async function restoreInterface(browser, session, previous, version) {
  if (!previous || previous === version) return;
  let problem = null;
  try {
    const saved = await callPreferences(browser, session, 'PUT', { interfaceVersion: previous });
    if (saved.status !== 200) problem = `HTTP ${saved.status}`;
  } catch (error) {
    problem = error.message;
  }
  if (problem) {
    console.error(`::warning::Could not put the demo account back on ${previous} (${problem}). Switch it back under Me, Settings.`);
  }
}
