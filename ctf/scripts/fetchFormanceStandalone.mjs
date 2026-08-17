#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_RAW_URL = 'https://raw.githubusercontent.com/formancehq/ledger/main/examples/standalone';
const OUT_DIR = path.resolve(process.cwd(), 'ops/formance/upstream-standalone');

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extractReferencedFiles(composeText) {
  const references = new Set();

  const patterns = [
    /^\s*env_file:\s*([./A-Za-z0-9_-]+)$/gm,
    /^\s*file:\s*([./A-Za-z0-9_-]+)$/gm,
    /^\s*source:\s*([./A-Za-z0-9_-]+)$/gm,
    /^\s*-\s*([./A-Za-z0-9_-]+)$/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(composeText)) !== null) {
      const value = match[1]?.trim();
      if (!value || value.startsWith('/') || value.includes(':')) {
        continue;
      }
      if (value === 'docker-compose.yml') {
        continue;
      }
      references.add(value.replace(/^\.\//, ''));
    }
  }

  return [...references].filter((entry) => !entry.endsWith('.png') && !entry.endsWith('.jpg'));
}

async function fetchAndWriteRelativeFile(relativePath) {
  const normalized = relativePath.replace(/^\.\//, '');
  const url = `${BASE_RAW_URL}/${normalized}`;
  const targetPath = path.join(OUT_DIR, normalized);
  await mkdir(path.dirname(targetPath), { recursive: true });
  const content = await fetchText(url);
  await writeFile(targetPath, content, 'utf8');
  return { url, targetPath };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const composeUrl = `${BASE_RAW_URL}/docker-compose.yml`;
  const composeContent = await fetchText(composeUrl);
  const composeTarget = path.join(OUT_DIR, 'docker-compose.yml');
  await writeFile(composeTarget, composeContent, 'utf8');

  const referencedFiles = extractReferencedFiles(composeContent);
  const fetched = [];
  for (const relativeFile of referencedFiles) {
    try {
      fetched.push(await fetchAndWriteRelativeFile(relativeFile));
    } catch {
      // no-trace: upstream compose references optional files that may not exist on the raw path.
    }
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    composeUrl,
    composeTarget,
    referencedFiles,
    fetchedFiles: fetched.map((item) => ({
      source: item.url,
      target: item.targetPath,
    })),
  };

  const summaryPath = path.join(OUT_DIR, 'FETCH_SUMMARY.json');
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`Fetched Formance standalone compose into: ${OUT_DIR}`);
  console.log(`Compose file: ${composeTarget}`);
  console.log(`Summary: ${summaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
