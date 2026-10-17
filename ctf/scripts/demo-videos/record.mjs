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
const signInUrl = process.env.DEMO_SIGN_IN_URL || 'https://accounts.app.chargingthefuture.com/sign-in';
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
  };
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
    try {
      if (step.do) await step.do(tools);
    } catch (error) {
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

async function main() {
  const clips = await loadClips(process.argv.slice(2).filter((a) => a && a !== 'all'));
  mkdirSync(workRoot, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const storageFile = join(workRoot, 'session.json');
  const failures = [];
  try {
    if (clips.some((c) => c.signIn !== false)) {
      await signInDemoAccount(browser, { appUrl, signInUrl, storageFile });
      console.log('Signed in as the demo account.');
    }
    for (const clip of clips) {
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
