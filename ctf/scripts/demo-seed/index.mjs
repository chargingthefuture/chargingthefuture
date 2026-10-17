// Loads the extra demo data modules in this folder. Each module adds what the demo videos and
// manual test scripts need for one plugin, on top of seedDemo.mjs, and is its own file so one
// plugin's demo data can change without touching another's.
//
// A module is any other .mjs file here, run in file-name order, exporting
//   export default async function seed(client, ctx) { ... }
// where client is the open transaction (search_path demo,public) and ctx carries the people and
// ids seedDemo.mjs created (see demoContext there). Every statement must be idempotent: the seed
// is re-run freely, and a re-run puts the module's rows back to the state it describes.
//
// DEMO_SEED_ONLY=a.mjs,b.mjs runs only the named modules, for checking one while others change.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export async function listDemoSeedModules() {
  const only = (process.env.DEMO_SEED_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
  const files = readdirSync(here)
    .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
    .filter((f) => only.length === 0 || only.includes(f))
    .sort();
  const modules = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(join(here, file)).href);
    if (typeof mod.default !== 'function') {
      throw new Error(`demo-seed/${file} must export a default async function (client, ctx)`);
    }
    modules.push([`demo-seed/${file}`, mod.default]);
  }
  return modules;
}
