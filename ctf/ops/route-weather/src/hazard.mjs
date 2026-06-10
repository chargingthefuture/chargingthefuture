// Turns a weather sample into a driving verdict: DRIVE, CAUTION, or HOLD.
// Pure logic over the data the providers already return — no network, no state.
// Thresholds have sensible defaults for a high-profile truck and can be overridden
// with environment variables on the service (e.g. GUST_CAUTION_MPH=35).

const RANK = { DRIVE: 0, CAUTION: 1, HOLD: 2 };

function envNum(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

const THRESHOLDS = {
  gustCaution: envNum('GUST_CAUTION_MPH', 40), // high-profile rollover caution
  gustHold: envNum('GUST_HOLD_MPH', 60),
  windHold: envNum('WIND_HOLD_MPH', 50),
  iceTempF: envNum('ICE_TEMP_F', 32),
};

// Largest integer in a wind string like "10 to 15" → 15, or null.
function maxNumber(str) {
  if (!str) return null;
  const found = String(str).match(/\d+/g);
  return found ? Math.max(...found.map(Number)) : null;
}

// Assess one sample against active alert names. Returns the level and the short
// reasons that drove it (already worded for speaking aloud).
export function assessHazard(sample, alerts = []) {
  let level = 'DRIVE';
  const reasons = [];
  const bump = (candidate, reason) => {
    if (RANK[candidate] > RANK[level]) level = candidate;
    if (candidate !== 'DRIVE' && reason && !reasons.includes(reason)) reasons.push(reason);
  };

  const sustained = maxNumber(sample.windText);
  const gust = sample.gust ? maxNumber(sample.gust) : sustained;
  const cond = (sample.condition || '').toLowerCase();
  const temp = sample.tempF;
  const heavy = /heavy/.test(cond);
  const hasIce = /(freez|ice|sleet)/.test(cond);
  const hasSnow = /snow/.test(cond);
  const hasFog = /fog/.test(cond);
  const hasWet = /(rain|drizzle|shower|thunder)/.test(cond);

  if (gust != null && gust >= THRESHOLDS.gustHold) bump('HOLD', `gusting ${gust}`);
  else if (sustained != null && sustained >= THRESHOLDS.windHold) bump('HOLD', `wind ${sustained}`);
  else if (gust != null && gust >= THRESHOLDS.gustCaution) bump('CAUTION', `gusting ${gust}`);

  if (hasIce) bump('HOLD', 'ice');
  if (hasSnow && heavy) bump('HOLD', 'heavy snow');
  else if (hasSnow) bump('CAUTION', 'snow');
  if (temp != null && temp <= THRESHOLDS.iceTempF && (hasWet || hasSnow)) bump('CAUTION', 'freezing precipitation');
  if (hasFog) bump('CAUTION', 'fog');

  for (const event of alerts) {
    if (/warning/i.test(event)) bump('HOLD', event);
    else if (/(advisory|watch)/i.test(event)) bump('CAUTION', event);
  }

  return { level, reasons };
}

// Worst (highest) level across many.
export function worst(levels) {
  return levels.reduce((acc, l) => (RANK[l] > RANK[acc] ? l : acc), 'DRIVE');
}
