import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const scriptSource = readFileSync(new URL('./recognizeGdp.mjs', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../packages/web/lib/gdp/recognition.ts', import.meta.url), 'utf8');

test('LightHouse GDP recognition uses settled match values only', () => {
  for (const source of [scriptSource, appSource]) {
    assert.match(source, /pluginSlug:\s*['"]lighthouse['"]/);
    assert.match(source, /lighthouse_matches/);
    assert.match(source, /settlement_amount/);
    assert.match(source, /settlement_currency/);
    assert.match(source, /settled_at\s+IS\s+NOT\s+NULL/);
  }

  const lighthouseSource = scriptSource.slice(scriptSource.indexOf("pluginSlug: 'lighthouse'"));
  assert.doesNotMatch(lighthouseSource, /lighthouse_properties/);
  assert.doesNotMatch(lighthouseSource, /SUM\([^)]*monthly_rent/);
});
