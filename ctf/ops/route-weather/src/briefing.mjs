// Scheduled briefing: builds the route report once and pushes it to your phone
// as a plain-text notification, then exits. Meant to run from a GitHub Actions
// cron (see .github/workflows/route-weather-briefing.yml), so there is no
// always-on server cost for the scheduled half.
//
// Configuration (all via environment variables / GitHub secrets — never hardcode):
//   ROUTE_FROM    required, e.g. "Denver, CO"
//   ROUTE_TO      required, e.g. "Salt Lake City, UT"
//   ROUTE_VIA     optional, semicolon-separated, e.g. "Vail, CO; Grand Junction, CO"
//   ROUTE_DEPART  optional, "HH:MM" or ISO; defaults to now
//   ROUTE_MPH     optional, defaults to 55
//   NTFY_TOPIC    optional, an ntfy.sh topic name to publish to (ntfy.sh app)
//   NTFY_URL      optional, full base URL of a self-hosted ntfy (default https://ntfy.sh)
// If no NTFY_TOPIC is set the report is printed to stdout (visible in the Action log).

import { buildRouteReport } from './report.mjs';

async function main() {
  const from = process.env.ROUTE_FROM;
  const to = process.env.ROUTE_TO;
  if (!from || !to) {
    console.error('[briefing] ROUTE_FROM and ROUTE_TO are required.');
    process.exit(1);
  }
  const via = (process.env.ROUTE_VIA || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const text = await buildRouteReport({
    from,
    to,
    via,
    depart: process.env.ROUTE_DEPART || undefined,
    mph: process.env.ROUTE_MPH || undefined,
  });

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.log(text);
    return;
  }
  const base = (process.env.NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '');
  const res = await fetch(`${base}/${topic}`, {
    method: 'POST',
    headers: { Title: 'Route weather', 'Content-Type': 'text/plain; charset=utf-8' },
    body: text,
  });
  if (!res.ok) {
    console.error(`[briefing] push failed: HTTP ${res.status}`);
    process.exit(1);
  }
  console.log('[briefing] pushed.');
}

main().catch((err) => {
  console.error(`[briefing] ${err.message}`);
  process.exit(1);
});
