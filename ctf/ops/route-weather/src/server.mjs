// Tiny no-UI HTTP server. Returns text/plain weather for a route or a point so an
// Apple Shortcut (or curl, or anything) can read it and Siri can speak it.
//
//   GET /health                                  → "ok"
//   GET /weather?lat=39.7&lon=-104.9             → current + next 3h at a point
//   GET /weather?from=Denver,CO&to=Vail,CO       → multi-stop route, ETA-aligned
//        &via=Frisco,CO&depart=06:00&mph=55
//
// If ROUTE_WEATHER_TOKEN is set, every /weather request must send it as either
// `Authorization: Bearer <token>` or `?token=<token>`. This keeps strangers from
// running up the (free) weather APIs on your behalf. The token never appears in
// any committed file — set it as a Render/Infisical environment variable.

import http from 'node:http';
import { buildRouteReport, buildPointReport } from './report.mjs';

const PORT = Number(process.env.PORT) || 3000;
const TOKEN = process.env.ROUTE_WEATHER_TOKEN || '';

if (!TOKEN) {
  console.warn('[route-weather] ROUTE_WEATHER_TOKEN is not set — /weather is OPEN to anyone.');
}

function authorized(req, url) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || '';
  const bearer = header.replace(/^Bearer\s+/i, '');
  return bearer === TOKEN || url.searchParams.get('token') === TOKEN;
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body.endsWith('\n') ? body : `${body}\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') return sendText(res, 200, 'ok');
  if (url.pathname !== '/weather') return sendText(res, 404, 'not found');
  if (!authorized(req, url)) return sendText(res, 401, 'unauthorized');

  try {
    const q = url.searchParams;
    let text;
    if (q.has('lat') && q.has('lon')) {
      text = await buildPointReport({ lat: q.get('lat'), lon: q.get('lon') });
    } else if (q.has('from') && q.has('to')) {
      text = await buildRouteReport({
        from: q.get('from'),
        to: q.get('to'),
        via: q.getAll('via'),
        depart: q.get('depart') || undefined,
        mph: q.get('mph') || undefined,
      });
    } else {
      return sendText(res, 400, 'give either lat+lon, or from+to (with optional via, depart, mph)');
    }
    return sendText(res, 200, text);
  } catch (err) {
    return sendText(res, 502, `could not build the report: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`[route-weather] listening on :${PORT}`);
});
