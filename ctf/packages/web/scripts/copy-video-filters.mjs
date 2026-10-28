// Copies the background blur model and its WebAssembly out of the installed
// @stream-io/video-filters-web package into public/video-filters, so calls load them from this app
// rather than from a third-party server (components/shared/call-safety.tsx). Runs before dev and
// build; the copied files are not committed (.gitignore). A missing package fails the build loudly.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const requireFromWeb = createRequire(join(here, '..', 'package.json'));
// Neither package lists its package.json in "exports", so resolve the entry file and walk up to the
// folder that holds package.json.
function packageRoot(entry) {
  let dir = dirname(entry);
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);
  return dir;
}
const sdkRoot = packageRoot(requireFromWeb.resolve('@stream-io/video-react-sdk'));
const filtersRoot = packageRoot(createRequire(join(sdkRoot, 'package.json')).resolve('@stream-io/video-filters-web'));
const source = join(filtersRoot, 'mediapipe');
const target = join(here, '..', 'public', 'video-filters');

const files = [
  'models/selfie_segmenter.tflite',
  'models/selfie_segmenter_landscape.tflite',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
];

for (const file of files) {
  mkdirSync(dirname(join(target, file)), { recursive: true });
  copyFileSync(join(source, file), join(target, file));
}
console.log(`copy-video-filters: ${files.length} files into public/video-filters`);
