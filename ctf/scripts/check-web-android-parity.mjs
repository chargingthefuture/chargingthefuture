#!/usr/bin/env node
/* eslint-env node */
/* global console, process */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRegistryPath = path.join(root, 'packages', 'web', 'lib', 'plugins', 'repository.ts');
const pluginRoutePath = path.join(root, 'packages', 'web', 'app', 'apps', '[pluginSlug]', 'page.tsx');
const parityContractsPath = path.join(root, 'config', 'plugin-parity-contracts.json');

const pluginRegistryText = fs.readFileSync(pluginRegistryPath, 'utf8');
const pluginRouteText = fs.readFileSync(pluginRoutePath, 'utf8');
const parityContractsText = fs.readFileSync(parityContractsPath, 'utf8');

const pluginRegistryEntries = [];
const pluginRegistryEntryRegex = /slug:\s*'([^']+)'[\s\S]*?availabilityState:\s*'(implemented_shell|planned|alpha|beta)'[\s\S]*?isVisible:\s*(true|false)/g;
let match;

while ((match = pluginRegistryEntryRegex.exec(pluginRegistryText)) !== null) {
  pluginRegistryEntries.push({
    slug: match[1],
    availabilityState: match[2],
    isVisible: match[3] === 'true',
  });
}

if (pluginRegistryEntries.length === 0) {
  console.error('Web/Android parity check failed. Could not read plugin registry entries.');
  process.exit(1);
}

const pluginRegistryEntryBySlug = new Map(pluginRegistryEntries.map((entry) => [entry.slug, entry]));

let parityContracts;

try {
  parityContracts = JSON.parse(parityContractsText);
} catch {
  console.error('Web/Android parity check failed. Unable to parse plugin parity contracts JSON.');
  process.exit(1);
}

if (!Array.isArray(parityContracts?.plugins)) {
  console.error('Web/Android parity check failed. Contracts must contain a plugins array.');
  process.exit(1);
}

const parityContractsBySlug = new Map();
for (const contract of parityContracts.plugins) {
  if (!contract || typeof contract !== 'object') {
    console.error('Web/Android parity check failed. Contract entries must be objects.');
    process.exit(1);
  }

  const slug = contract.slug;
  const mobileFeatureDirs = contract.mobileFeatureDirs;

  if (typeof slug !== 'string' || slug.trim().length === 0) {
    console.error('Web/Android parity check failed. Contract slug must be a non-empty string.');
    process.exit(1);
  }

  if (!Array.isArray(mobileFeatureDirs)) {
    console.error(`Web/Android parity check failed. ${slug} must declare mobileFeatureDirs as an array.`);
    process.exit(1);
  }

  // Under the narrowed-Android-scope policy (rule 105) the native app carries only a small
  // keep-list; a web-only plugin (requiresMobileSurface: false) is served by the web app and may
  // therefore declare an empty mobileFeatureDirs. The non-empty requirement applies only when the
  // plugin still requires a native Android surface.
  if (contract.requiresMobileSurface === true && mobileFeatureDirs.length === 0) {
    console.error(`Web/Android parity check failed. ${slug} must declare mobileFeatureDirs.`);
    process.exit(1);
  }

  if (parityContractsBySlug.has(slug)) {
    console.error(`Web/Android parity check failed. Duplicate contract slug: ${slug}`);
    process.exit(1);
  }

  parityContractsBySlug.set(slug, contract);
}

const implementedRouteSlugSet = new Set();
const routeSlugRegex = /selectedPlugin\.slug\s*===\s*'([^']+)'/g;

while ((match = routeSlugRegex.exec(pluginRouteText)) !== null) {
  implementedRouteSlugSet.add(match[1]);
}

const mobileFeatureDir = path.join(root, 'packages', 'mobile', 'src', 'features');
const mobileFeatureDirs = new Set(
  fs
    .readdirSync(mobileFeatureDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

const missing = [];
const routeGaps = [];
const missingContracts = [];
const contractRegistryMismatches = [];

for (const registryEntry of pluginRegistryEntries) {
  const contract = parityContractsBySlug.get(registryEntry.slug);
  if (!contract) {
    missingContracts.push(registryEntry.slug);
    continue;
  }

  const requiredMobileDirs = contract.mobileFeatureDirs;
  const allPresent = requiredMobileDirs.every((dir) => mobileFeatureDirs.has(dir));

  if (registryEntry.availabilityState === 'implemented_shell' && contract.requiresMobileSurface && !allPresent) {
    missing.push({ pluginId: registryEntry.slug, requiredMobileDirs });
  }

  if (
    registryEntry.availabilityState === 'implemented_shell'
    && registryEntry.isVisible
    && contract.requiresExplicitWebShell
    && !implementedRouteSlugSet.has(registryEntry.slug)
  ) {
    routeGaps.push(registryEntry.slug);
  }
}

for (const [slug, contract] of parityContractsBySlug.entries()) {
  const registryEntry = pluginRegistryEntryBySlug.get(slug);
  if (!registryEntry) {
    contractRegistryMismatches.push({ slug, issue: 'missing in web registry' });
    continue;
  }

  if (contract.requiresExplicitWebShell && !registryEntry.isVisible) {
    contractRegistryMismatches.push({ slug, issue: 'contract requires explicit web shell but plugin is hidden' });
  }
}

if (missing.length > 0 || routeGaps.length > 0 || missingContracts.length > 0 || contractRegistryMismatches.length > 0) {
  console.error('Web/Android parity check failed. Missing Android feature surface(s):');
  for (const item of missing) {
    console.error(`- ${item.pluginId} -> expected mobile dirs: ${item.requiredMobileDirs.join(', ')}`);
  }

  if (missingContracts.length > 0) {
    console.error('Parity contracts are missing entries for web registry plugins:');
    for (const slug of missingContracts) {
      console.error(`- ${slug}`);
    }
  }

  if (routeGaps.length > 0) {
    console.error('Behavioral parity route gaps (implemented + visible, but explicit web shell is missing):');
    for (const pluginId of routeGaps) {
      console.error(`- ${pluginId}`);
    }
  }

  if (contractRegistryMismatches.length > 0) {
    console.error('Contract and web registry mismatch(es):');
    for (const item of contractRegistryMismatches) {
      console.error(`- ${item.slug}: ${item.issue}`);
    }
  }

  process.exit(1);
}

console.log('Web/Android parity check passed.');
