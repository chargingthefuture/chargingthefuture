/* eslint-env node */
/* global console, process, require */
// The 3.1 speed budget (ctf/docs/developer/SOCIAL_REDESIGN_3_1_PLAN.md, Measures): from a cold
// start to the first card in under 3 seconds, and under 1 second warm, on a low-cost Android phone
// over a slow connection. Measures signed-out Today (/today), which runs the same Today screen and
// frame a member sees, against a running build.
//
// The phone is Chromium at phone width with its CPU slowed 4 times. The connection is simulated
// here rather than by the browser: every request is answered by this script from the running app,
// held for a 150 ms round trip and sent at 1.6 Mbit/s over one shared link (slow 4G as Lighthouse
// defines it). Warm reuses the scripts, styles and fonts from the first visit, as the phone's cache
// does. Each is the median of three runs.
//
// Usage: node measure-today.cjs http://localhost:3000
// Exits 1 when a median is over budget. Writes a table to GITHUB_STEP_SUMMARY when it is set.
const http = require('node:http');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { chromium } = require('playwright');

const APP = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const VIRTUAL = 'http://app.local';
const BUDGET_MS = { cold: 3000, warm: 1000 };
const RUNS = 3;
const RTT_MS = 150;
const BYTES_PER_MS = (1.6 * 1024 * 1024) / 8 / 1000;

function fetchApp(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      { host: target.hostname, port: target.port, path: target.pathname + target.search, method, headers: { ...headers, 'accept-encoding': 'gzip' } },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function decoded(res) {
  const headers = { ...res.headers };
  delete headers['content-length'];
  delete headers['transfer-encoding'];
  delete headers['content-encoding'];
  const body = res.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(res.body) : res.body;
  return { status: res.status, headers, body };
}

async function measure() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const cache = new Map();
  const state = { linkFree: 0, bytes: 0, warm: false };
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (!url.startsWith(VIRTUAL)) return route.abort();
    const cacheable = /\/_next\/static\//.test(url);
    if (state.warm && cacheable && cache.has(url)) return route.fulfill(cache.get(url));
    try {
      const res = await fetchApp(url.replace(VIRTUAL, APP), req.method(), await req.allHeaders(), req.postDataBuffer());
      const now = Date.now();
      const sendStart = Math.max(now + RTT_MS, state.linkFree);
      state.linkFree = sendStart + res.body.length / BYTES_PER_MS;
      state.bytes += res.body.length;
      await new Promise((resolve) => setTimeout(resolve, state.linkFree - now));
      const out = decoded(res);
      if (cacheable) cache.set(url, out);
      return route.fulfill(out);
    } catch (error) {
      console.error(`Request to ${url} failed: ${error.message}`);
      return route.abort();
    }
  });

  const results = { cold: [], warm: [] };
  for (let run = 0; run < RUNS; run += 1) {
    for (const kind of ['cold', 'warm']) {
      if (kind === 'cold') cache.clear();
      state.warm = kind === 'warm';
      state.bytes = 0;
      state.linkFree = 0;
      const started = Date.now();
      await page.goto(`${VIRTUAL}/today`, { waitUntil: 'commit', timeout: 120000 });
      // The first card: Today's list heading is up and the read has settled (cards or a notice).
      await page.waitForFunction(
        () => [...document.querySelectorAll('h2')].some((h) => h.textContent.includes("Today's cards")) && !document.body.innerText.includes('Loading Today'),
        null,
        { timeout: 120000 },
      );
      results[kind].push({ ms: Date.now() - started, kb: Math.round(state.bytes / 1024) });
    }
  }
  await browser.close();
  return results;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

measure()
  .then((results) => {
    const rows = ['cold', 'warm'].map((kind) => {
      const ms = median(results[kind].map((r) => r.ms));
      const kb = median(results[kind].map((r) => r.kb));
      return { kind, ms, kb, ok: ms <= BUDGET_MS[kind], runs: results[kind].map((r) => r.ms).join(', ') };
    });
    const table = [
      '## 3.1 speed budget: signed-out Today',
      '',
      '| Load | First card (median) | Budget | Over the network | Runs (ms) | Result |',
      '|---|---:|---:|---:|---|---|',
      ...rows.map((r) => `| ${r.kind} | ${r.ms} ms | ${BUDGET_MS[r.kind]} ms | ${r.kb} KB | ${r.runs} | ${r.ok ? 'within' : 'over'} |`),
      '',
      'Chromium at phone width, CPU slowed 4 times, 150 ms round trip at 1.6 Mbit/s.',
    ].join('\n');
    console.log(table);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
    process.exit(rows.every((r) => r.ok) ? 0 : 1);
  })
  .catch((error) => {
    console.error(`The speed measurement could not run: ${error.message}`);
    process.exit(1);
  });
