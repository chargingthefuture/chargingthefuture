# route-weather (personal / experimental — not a community plugin)

A no-UI, plain-text weather service for driving. You give it a start and end
place (and optional stops along the way), or just your current location, and it
replies with **plain text** — temperature, wind (with gusts), conditions, and any
active hazard alerts — timed to roughly when you'll reach each stop. No HTML, no
ads, no styling. Built to be read by eye at a stop, or spoken aloud by Siri while
driving.

This lives under `ctf/ops/` on purpose: it is a **standalone service, not a
plugin**. It has no database, no schema, no UI surface, and is not in the plugin
registry — so it does not go through the design-pass gate or the plugin feature
inventory process. It reuses the repo's existing build-and-deploy pipeline
(GitHub Actions builds a Docker image → GHCR → Render pulls it) and nothing else.

## Two halves

| Half | What it is | Where it runs | Cost |
|---|---|---|---|
| **On-demand** | An HTTP endpoint you call (e.g. from an Apple Shortcut) and get plain text back | `ctf-route-weather` web service on Render | one small instance |
| **Scheduled briefing** | A daily/whenever push of a fixed route to your phone | a GitHub Actions cron → ntfy.sh notification | free |

## Data sources (both keyless)

- **US points → National Weather Service** (`api.weather.gov`): temperature, wind,
  and active hazard alerts (high wind, winter storm, ice, blowing dust, etc.).
- **Everywhere else → Open-Meteo** (`api.open-meteo.com`): temperature, wind, and
  explicit wind **gusts**, worldwide. No hazard alerts outside the US.
- Place names → Open-Meteo geocoding.

**Honest limit on "road conditions":** weather APIs do not report road surface
state (ice on the deck, closures, chain controls). What you get here is the
*weather hazard* half — the part that tells you whether to roll — via NWS alerts
plus wind/temp. True surface and closure data comes from each state's DOT 511
feed; wiring those in is a later add, not in this first version.

## The endpoint

```
GET /health
GET /weather?lat=39.74&lon=-104.99
GET /weather?from=Denver,CO&to=Salt Lake City,UT&via=Vail,CO&via=Grand Junction,CO&depart=06:00&mph=55
```

- `lat`+`lon` → current conditions plus the next three hours at that point.
- `from`+`to` (plus any number of `via`) → one line per stop, each showing the
  forecast for the estimated time you'll arrive. `depart` is `HH:MM` (read in the
  origin's time zone) or a full timestamp; `mph` defaults to 58 (a loaded truck's
  effective rolling average). Arrival times are estimated from straight-line
  distance × 1.25, so treat them as approximate — they only bucket each stop to
  the nearest forecast hour.

The phrasing is written to be spoken cleanly by Siri (directions as words,
"degrees", 12-hour times) while still reading fine by eye. Example reply:

```
ROUTE WX. Denver Colorado to Salt Lake City Utah.

Now, Denver Colorado: 34 degrees, wind west 12, clear.
10:36 AM, Vail Colorado: 21 degrees, wind northwest 28 gusting 41, light snow. ALERT: Winter Weather Advisory.
5:10 PM, Salt Lake City Utah: 44 degrees, wind south 9, rain.

Alerts: Winter Weather Advisory at Vail Colorado.

(Times in America/Denver. ETAs assume 58 mph and are approximate.)
```

### Access token

If the environment variable `ROUTE_WEATHER_TOKEN` is set, every `/weather` call
must send it, either as `Authorization: Bearer <token>` or `?token=<token>`.
This stops strangers from running up the weather APIs through your endpoint. The
token is never committed — set it as a Render service environment variable (via
Infisical → Render Sync, same as every other secret in this repo). Generate one
locally with `openssl rand -hex 16`.

## Run it locally

```sh
cd ctf/ops/route-weather
node src/server.mjs
# then, in another terminal:
curl "localhost:3000/weather?from=Denver,CO&to=Vail,CO&depart=06:00"
```

No `npm install` — there are no dependencies.

## Deploy (uses the existing pipeline)

1. Merge to `main`. `build-images.yml` builds `ghcr.io/chargingthefuture/ctf-route-weather:latest` and pushes it to GHCR (path-filtered: only rebuilds when `ctf/ops/route-weather/**` changes).
2. **First time only:** make the new GHCR package public (org → Packages → `ctf-route-weather` → Package settings → visibility → Public), so Render can pull it without credentials.
3. The `ctf-route-weather` service in `render.yaml` pulls the image. Set `ROUTE_WEATHER_TOKEN` on it in Infisical/Render.
4. The endpoint is then at `https://ctf-route-weather.onrender.com/weather?...` (or whatever domain Render assigns).

> A free/idle Render instance can cold-start (~30–60s) on the first request after
> a quiet spell. If that lag bothers you while driving, run it on a small
> always-on plan or add a keep-warm ping.

## The scheduled briefing

`.github/workflows/route-weather-briefing.yml` runs `src/briefing.mjs` on a cron.
It builds the report for a fixed route (from repository **variables**) and pushes
it to your phone via [ntfy.sh](https://ntfy.sh) (install the ntfy app, subscribe
to your topic). Configure under the repo's Settings → Secrets and variables →
Actions:

- Variables: `ROUTE_FROM`, `ROUTE_TO`, `ROUTE_VIA` (optional, `;`-separated), `ROUTE_DEPART` (optional), `ROUTE_MPH` (optional).
- Secret: `NTFY_TOPIC` (the topic name; treat it as private since anyone who knows it can read your pushes).

If `NTFY_TOPIC` is absent the report is just printed in the Action log.

## Apple Shortcut (voice, no app to install)

1. **Get Current Location** (for the point report) — or skip for a fixed route.
2. **Get Contents of URL** → your endpoint, e.g.
   `https://ctf-route-weather.onrender.com/weather?lat=[Latitude]&lon=[Longitude]`,
   method GET, with header `Authorization: Bearer <your token>`.
3. **Get text from** the response.
4. **Speak Text**.

Name it "Road weather" and trigger it with "Hey Siri, road weather."
