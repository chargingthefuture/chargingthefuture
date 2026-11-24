// Shared steps for the 3.1 clips in clips-3-1/.
export const TAB_BAR = (page) => page.getByRole('navigation', { name: 'Main' });

// Opens the signed-in 3.1 home on a tab and waits for the tab bar.
export async function openTab(page, app, tab = 'today') {
  await page.goto(app(tab === 'today' ? '/' : `/?tab=${tab}`));
  await TAB_BAR(page).waitFor({ timeout: 30_000 });
}

export const tabButton = (page, name) => TAB_BAR(page).getByRole('button', { name, exact: true });
