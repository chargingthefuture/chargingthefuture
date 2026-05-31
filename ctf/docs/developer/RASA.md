# Rasa NLU Service (AI Assistant)

How the self-hosted Rasa NLU service works on Render, how to deploy it, and how to enable it for
the comic "AI Assistant" (`@comic`).

## What this service is

`ctf-rasa` is a **private** Render service (no public domain) running a Rasa 3.x **NLU-only**
project. It exposes the stateless HTTP API endpoint `POST /model/parse`, which classifies an
inbound `@comic` question into one of the comic intent categories (`housing`, `services`,
`general`, `safety`, `benefits`) and returns a calibratable confidence.

It is reachable only by the CTF web service over Render's internal network at
`http://ctf-rasa:5005`. Defined in `render.yaml` (image
`ghcr.io/chargingthefuture/ctf-rasa:latest`, built from `ctf/ops/rasa/Dockerfile`).

The project lives in `ctf/ops/rasa/`:

| File | Purpose |
|---|---|
| `config.yml` | NLU pipeline (WhitespaceTokenizer → featurizers → DIETClassifier → FallbackClassifier). No dialogue policies — NLU only. |
| `domain.yml` | The five comic intents + minimal placeholder responses. |
| `data/nlu.yml` | Seed NLU training examples per intent (starter set). |
| `credentials.yml` | REST channel only (private-network use). |
| `endpoints.yml` | Minimal; action server + SQL tracker store are **commented/deferred**. |
| `Dockerfile` | `rasa/rasa:3.6.21`, trains the model at build time, serves `--enable-api` on 5005. |

## Architecture

Render has no persistent volumes, so the trained NLU model is **baked into the image at build
time** — always present on startup, no runtime training and no network access needed on boot. This
mirrors how `ctf-ollama` bakes its model.

The comic backend uses Rasa **only to attach a real intent + confidence to each `@comic` turn**
for the reviewer's display and for better training labels. **Generation still happens in the app
via Ollama, and EVERY answer still goes to human review** — Rasa does **not** auto-publish anything.
See the comic feature inventory for the operating-mode contract.

## How the Dockerfile bakes the model

```dockerfile
FROM rasa/rasa:3.6.21
USER root
WORKDIR /app
COPY . /app
RUN ["rasa", "train", "nlu", "--num-threads", "1"]
RUN chown -R 1001:1001 /app
EXPOSE 5005
USER 1001
CMD ["run", "--enable-api", "-p", "5005", "--cors", "*"]
```

`rasa train nlu` writes a model tarball to `/app/models/`; that file persists in the image layer,
so the runtime container starts with the model already on disk. The base image's `ENTRYPOINT` is
`rasa`, so `CMD` only supplies the `run` subcommand and flags.

## Deploy runbook

1. **Edit the project** under `ctf/ops/rasa/` (e.g. add training examples to `data/nlu.yml`),
   commit, and push to `main`. `build-images.yml` is **path-filtered on `ctf/ops/rasa/**`** — the
   `ctf-rasa` image rebuilds (training the model) and pushes to
   `ghcr.io/chargingthefuture/ctf-rasa:latest` only when these files change.
2. **First time only — make the GHCR package public.** After the first successful build, go to
   `github.com/orgs/chargingthefuture/packages` → `ctf-rasa` → Package settings → Change
   visibility → **Public**. This lets Render pull the image without registry credentials (same
   step as every other `ctf-*` image).
3. **Render deploys** the pre-built image. If `RENDER_API_KEY` + `RENDER_SERVICE_ID_RASA` GitHub
   secrets are set, the build job triggers the deploy automatically; otherwise deploy from the
   Render dashboard / Blueprint sync.
4. **Enable it on the web service.** Set `RASA_BASE_URL=http://ctf-rasa:5005` on **ctf-web** via
   Infisical → Render Sync (the same mechanism that injects `OLLAMA_BASE_URL`). This is the switch:
   once set, the comic backend calls Rasa; until set, it does not (see "Graceful degradation").

> **Validation required before enabling in prod.** This project was authored to Rasa 3.x
> conventions but has **not** been trained or run in this environment. Before flipping
> `RASA_BASE_URL` on, confirm a real `rasa train nlu` succeeds in CI (the image build) and the
> deployed service answers `POST /model/parse` — see "Confirming it works".

## Web service configuration

- `RASA_BASE_URL=http://ctf-rasa:5005` — the switch that enables the integration. Injected on
  ctf-web via Infisical → Render Sync.
- `RASA_MODEL` (optional) — informational label only; the served model is whatever was baked into
  the image. Not required for the integration to work.

## Graceful degradation (important)

The comic backend is **safe by default**. In `lib/comic/rasa.ts`, `isRasaConfigured()` returns
`true` **iff `RASA_BASE_URL` is set**. In `routeComicMessage` (`lib/comic/repository.ts`) the Rasa
call is made **only** when `isRasaConfigured()` is true.

- **`RASA_BASE_URL` unset** → no Rasa call; the user turn is stored with `intent: null` and
  `nlu_confidence: null`, exactly as before this service existed. Behavior is byte-for-byte
  unchanged.
- **`RASA_BASE_URL` set but Rasa unreachable / errors / times out** → `parseComicIntent` catches
  everything and returns `{ intent: null, confidence: null }`; the turn is stored with nulls and
  routing continues. No request fails because of Rasa.

Either way, **every answer still goes to human review** (`forceHumanReview()` is unchanged). Rasa
provides labels, never an auto-publish bypass.

## Confirming it works

From a shell that can reach the private network (e.g. a Render shell on ctf-web):

```sh
curl -s -X POST http://ctf-rasa:5005/model/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"i need emergency shelter tonight"}'
```

Expect JSON with `intent.name` (e.g. `housing`) and `intent.confidence` (a 0..1 float), plus an
`intent_ranking` array. In the app, after setting `RASA_BASE_URL`, a new `@comic` turn's review
item should show a real intent + a confidence band (instead of "Not yet scored").

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails at `rasa train nlu` | Malformed `config.yml`/`domain.yml`/`nlu.yml`, or an intent in `nlu.yml` not declared in `domain.yml` | Validate the YAML; keep the five intents in sync across `domain.yml` and `data/nlu.yml` |
| Build times out | Training too large for the CI runner | Reduce `DIETClassifier.epochs` or trim examples; keep `--num-threads 1` |
| Review items still show "Not yet scored" | `RASA_BASE_URL` not set on ctf-web | Set `RASA_BASE_URL=http://ctf-rasa:5005` via Infisical → Render Sync |
| `parseComicIntent` always returns null but the var is set | Service unreachable, wrong port, or `/model/parse` errored | Confirm `ctf-rasa` is healthy and listening on 5005; check the curl above |
| Want to retrain on new data | Corrections accumulated in the app | Export via `GET /api/comic/training/export` (and the feed Rasa export), append the YAML under the matching intents in `data/nlu.yml`, commit → rebuild |

## Notes

- Never assign a public domain to `ctf-rasa` — it has no authentication and must stay
  private-network only (same rule as `ctf-ollama`).
- The intent set MUST stay in sync with the comic backend categories and with
  `exportQuestionsForRasa` (`lib/feed/repository.ts`) so exported training YAML drops straight into
  `data/nlu.yml`.

## Deferred next steps (documented, NOT built here)

These are intentionally out of scope for the initial service and are recorded so the path is clear:

1. **Rasa custom action → Ollama for generation.** Move answer generation behind a Rasa custom
   action (would add an action server + uncomment `action_endpoint` in `endpoints.yml`). Today
   generation stays in the app (`generateComicDraft` → Ollama).
2. **SQL tracker store on Neon.** Rasa's conversation event store, needed only for stateful
   dialogue (stories). NLU `/model/parse` is stateless, so none is provisioned yet. When added,
   inject credentials via Infisical → Render Sync (never commit them — public repo).
3. **Raise the auto-respond threshold / confidence-based auto-publish.** A deliberate later step,
   only once the owner trusts the bot. Until then `forceHumanReview()` stays `true` and **every**
   answer is reviewed by a human regardless of confidence.
