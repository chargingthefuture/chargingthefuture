#!/usr/bin/env node
// Records the demo clips in clips/: a phone-sized browser clicks through each one while it is
// filmed, a voice reads the narration, and the captions are burned in. README.md says how to add a
// clip and how to set up the demo account it signs in as.
//
//   node ctf/scripts/demo-videos/record.mjs              every clip
//   node ctf/scripts/demo-videos/record.mjs goal-board   only the clips named
//
// Output: <slug>.mp4 and <slug>.vtt in DEMO_OUT_DIR (default ctf/scripts/demo-videos/out).
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { narrateSteps } from './lib/narrate.mjs';
import { assemble, buildCues, writeCaptions } from './lib/assemble.mjs';
import { signInDemoAccount } from './lib/sign-in.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appUrl = (process.env.DEMO_APP_URL || 'https://app.chargingthefuture.com').replace(/\/$/, '');
const outDir = process.env.DEMO_OUT_DIR || join(here, 'out');
const workRoot = join(outDir, '.work');

// The app ships one phone-width layout at every size, so the clips are filmed at phone size.
const VIEWPORT = { width: 390, height: 844 };
const GAP_SECONDS = 0.5;
const END_HOLD_MS = 1200;

// Playwright is a tool for this script, not a repository dependency: the workflow installs it, and
// the dev container has it globally.
async function loadChromium() {
  for (const specifier of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(specifier)).chromium;
    } catch {
      // no-trace: this specifier is not installed, so try the next candidate
    }
  }
  throw new Error('Playwright is not installed. The workflow installs it; locally, run `npm i -g playwright`.');
}

// A circle where each tap lands, so a viewer can follow what was pressed.
const TAP_MARKER = `
  addEventListener('pointerdown', (e) => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(255,127,80,.45);border:2px solid rgba(255,127,80,.9);transition:transform .45s,opacity .45s;left:' + e.clientX + 'px;top:' + e.clientY + 'px';
    document.documentElement.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1.8)'; dot.style.opacity = '0'; });
    setTimeout(() => dot.remove(), 600);
  }, true);
`;

async function loadClips(names) {
  const dir = join(here, 'clips');
  const clips = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const clip = (await import(pathToFileURL(join(dir, file)).href)).default;
    if (!clip?.slug || !Array.isArray(clip.steps) || clip.steps.length === 0) {
      throw new Error(`clips/${file} must export default { slug, title, steps: [{ say, do }] }.`);
    }
    clips.push(clip);
  }
  if (names.length === 0) return clips;
  const missing = names.filter((n) => !clips.some((c) => c.slug === n));
  if (missing.length) throw new Error(`No clip named ${missing.join(', ')}. Clips: ${clips.map((c) => c.slug).join(', ')}.`);
  return clips.filter((c) => names.includes(c.slug));
}

function helpers(page) {
  return {
    page,
    app: (path = '/') => `${appUrl}${path.startsWith('/') ? path : `/${path}`}`,
    pause: (seconds) => page.waitForTimeout(seconds * 1000),
    // Wheel scrolling from the middle of the screen moves whichever panel is under it, which is
    // what a thumb would do; window.scrollBy would miss the app's inner scroll areas.
    scroll: async (pixels) => {
      await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
      const step = pixels > 0 ? 60 : -60;
      for (let moved = 0; Math.abs(moved) < Math.abs(pixels); moved += step) {
        await page.mouse.wheel(0, step);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(300);
    },
    // A button by its visible text or aria-label. exact, so "Session" does not match "Join Session".
    button: (name) => page.getByRole('button', { name, exact: true }).first(),
    // Rings the element in coral and dims the rest of the screen while the step's sentence plays.
    // The ring is cleared when the next step starts, so a step that highlights nothing shows none.
    highlight: async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error('the element to highlight is not on screen');
      await page.evaluate(({ x, y, width, height }) => {
        const ring = document.createElement('div');
        ring.className = '__demo-highlight';
        ring.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:${x - 6}px;top:${y - 6}px;width:${width + 12}px;height:${height + 12}px;border:3px solid #ff7f50;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.45);`;
        document.documentElement.appendChild(ring);
      }, box);
    },
  };
}

async function clearHighlights(page) {
  try {
    await page.evaluate(() => document.querySelectorAll('.__demo-highlight').forEach((ring) => ring.remove()));
  } catch {
    // no-trace: the page was between documents, and a new document has no ring to clear
  }
}

async function recordClip(browser, clip, storageFile) {
  const workDir = join(workRoot, clip.slug);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const narration = narrateSteps(clip.steps, workDir);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // The Session clips join a real call: the launch flags below give the browser a test-pattern
    // camera and a tone for a microphone, and this lets the page use them without a prompt.
    permissions: ['camera', 'microphone'],
    storageState: clip.signIn === false ? undefined : storageFile,
    // Playwright films at the viewport's own size whatever the pixel density; assemble() doubles it.
    recordVideo: { dir: workDir, size: VIEWPORT },
  });
  await context.addInitScript(TAP_MARKER);
  const page = await context.newPage();
  const startedAt = Date.now();
  const tools = helpers(page);
  const placed = [];

  for (const [index, step] of clip.steps.entries()) {
    await clearHighlights(page);
    try {
      if (step.do) await step.do(tools);
    } catch (error) {
      // What the browser showed when the step gave up; kept in the run artifact.
      await page.screenshot({ path: join(outDir, `${clip.slug}-failure.png`) }).catch((shotError) => {
        console.error(`Could not save the failure screenshot for ${clip.slug}: ${shotError.message}`);
      });
      await context.close();
      throw new Error(`Clip ${clip.slug}, step ${index + 1} ("${step.say.slice(0, 50)}") failed on screen: ${error.message}`);
    }
    const start = (Date.now() - startedAt) / 1000;
    placed.push({ ...narration[index], start, text: step.say });
    await page.waitForTimeout((narration[index].seconds + GAP_SECONDS) * 1000);
  }
  await page.waitForTimeout(END_HOLD_MS);
  const video = page.video();
  const seconds = (Date.now() - startedAt) / 1000;
  await context.close();
  const webm = join(workDir, 'screen.webm');
  renameSync(await video.path(), webm);

  const cues = buildCues(placed);
  const { srtFile, vttFile } = writeCaptions(cues, workDir, clip.slug);
  const output = join(outDir, `${clip.slug}.mp4`);
  assemble({ video: webm, narration: placed, srtFile, output, seconds });
  renameSync(vttFile, join(outDir, `${clip.slug}.vtt`));
  return output;
}

// DEMO_SHARD=i/n keeps every n-th clip starting at i, so n machines can record a long list side by
// side. Without it, every clip is recorded here.
function shardOf(clips) {
  const shard = process.env.DEMO_SHARD;
  if (!shard) return clips;
  const [index, count] = shard.split('/').map(Number);
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
    throw new Error(`DEMO_SHARD="${shard}" is not of the form i/n with 0 <= i < n.`);
  }
  return clips.filter((_, position) => position % count === index);
}

async function main() {
  const clips = shardOf(await loadClips(process.argv.slice(2).filter((a) => a && a !== 'all')));
  if (clips.length === 0) {
    console.log('No clip falls in this shard.');
    return;
  }
  mkdirSync(workRoot, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const storageFile = join(workRoot, 'session.json');
  const failures = [];
  try {
    // A failed sign-in fails only the clips that need it; the public ones are still recorded.
    let signInError = null;
    if (clips.some((c) => c.signIn !== false)) {
      try {
        await signInDemoAccount(browser, { appUrl, storageFile, screenshotFile: join(outDir, 'sign-in-failure.png') });
        console.log('Signed in as the demo account.');
      } catch (error) {
        signInError = error;
        console.error(`::error::${error.message}`);
      }
    }
    for (const clip of clips) {
      if (signInError && clip.signIn !== false) {
        failures.push(clip.slug);
        console.error(`::error::Skipped ${clip.slug}: it needs the demo account and the sign-in failed.`);
        continue;
      }
      try {
        console.log(`Recorded ${clip.slug}: ${await recordClip(browser, clip, storageFile)}`);
      } catch (error) {
        failures.push(clip.slug);
        console.error(`::error::${error.message}`);
      }
    }
  } finally {
    await browser.close();
    rmSync(storageFile, { force: true });
  }
  if (failures.length) {
    console.error(`${failures.length} of ${clips.length} clips failed: ${failures.join(', ')}. The rest were written.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`::error::${error.message}`);
  process.exit(1);
});
