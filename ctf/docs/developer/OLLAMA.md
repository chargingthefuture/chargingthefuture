# Ollama Model Management

How the self-hosted Ollama service works and how to change its model. Ollama is the only
`@comic` AI engine: it writes a draft answer that a person reviews before any survivor sees it
(see the comic feature inventory). A third-party API is not used for survivor question text, so
the model stays self-hosted.

There are two ways to host it. The current setup runs a small model on a CPU box. The upgrade
moves a stronger model to a GPU host. Both are documented below.

## Why upgrade to a GPU host

The current model (`llama3.2`, ~3B parameters) runs on a CPU-only Render service. On CPU it is
both weak and slow. A stronger model (tens of billions of parameters) writes far better drafts but
needs a GPU — on CPU it would run far past the 30s request timeout in
`lib/chatbot/ollama.ts`. Render's plans have no GPUs, so a stronger model must run on an external
GPU host. Tracked in issue #502.

This is the owner's spend decision: an always-on GPU is a real monthly cost. Quantized mid-size
models keep that cost down while still being much better than `llama3.2`.

### Recommended models (Ollama library names)

| Model | Rough VRAM (quantized) | Notes |
|---|---|---|
| `qwen2.5:32b` | ~20–24 GB | Balanced default — strong instruction following, fits a single 24 GB GPU |
| `gemma2:27b` | ~18–22 GB | Similar tier, slightly smaller |
| `llama3.3` (70B) | ~40–48 GB | Highest quality of these; needs a larger, more expensive GPU |

Start with `qwen2.5:32b` unless the budget supports a 70B-class GPU. Test the chosen model's drafts
against real questions before relying on it.

## Moving to an external GPU host (the upgrade)

Two infrastructure steps — these need a GPU provider account and the secrets store, so the owner
does them:

1. Provision a GPU host running Ollama. Options: RunPod, Lambda, Fly.io GPU machines, or any host
   with a GPU. Install Ollama, run `ollama serve`, and `ollama pull <model>` (e.g.
   `ollama pull qwen2.5:32b`).
2. Secure it. Ollama has no built-in authentication, so the host must not be exposed on the open
   internet unprotected. Use one of:
   - the provider's private network so only the web service can reach it, or
   - a reverse proxy (Caddy/Nginx) in front of Ollama that checks an `Authorization: Bearer`
     token.
3. Set these on the web service (`ctf-web`) via Infisical → Render Sync:
   - `OLLAMA_BASE_URL` → the GPU host's URL (e.g. `https://ollama.example.internal`).
   - `OLLAMA_MODEL` → the exact model name pulled on the host (e.g. `qwen2.5:32b`).
   - `OLLAMA_API_KEY` → the bearer token, only if the host is behind a token-checking proxy. Leave
     unset when the host is private-network only. The web client attaches it as
     `Authorization: Bearer <token>` on every Ollama request (`lib/chatbot/ollama.ts`).

Once `OLLAMA_BASE_URL` points at the GPU host, the Render `ctf-ollama` service can be removed from
`render.yaml` and suspended in Render — it is no longer in the path.

## RunPod Serverless (pay-per-use GPU)

RunPod Serverless is the chosen GPU host: it bills per second a worker actively
runs a request and scales to zero when idle, so a low-traffic, human-reviewed chat
costs little. Cold starts (a worker loading the model from zero) can take tens of
seconds to minutes; that is acceptable here because the worst case is one draft
hitting the 30s timeout and falling back to the template, which a person still
reviews.

A RunPod Serverless **queue** endpoint speaks RunPod's job API, not Ollama's native
API. Two pieces make it work:

1. The worker image — a single `Dockerfile` that lives in the dedicated RunPod
   worker repo (`ctf/Runpod`), not in this monorepo. It runs Ollama plus a small
   Python handler (`runpod.serverless.start`) that forwards each job to Ollama's
   `/api/chat` and returns `{ content, model }`. Point the endpoint's GitHub build
   at that repo. Set the model with the `OLLAMA_MODEL` build argument (default
   `qwen2.5:32b`).
   - It lives in its own repo on purpose: pushes to this monorepo's `main` then
     never trigger a rebuild of the large (~20 GB) image — the endpoint only
     rebuilds when the worker repo changes, which is rare. The handler is inlined
     in the Dockerfile (no separate file), so the worker repo needs just the one
     `Dockerfile`.
2. The client adapter — `lib/chatbot/ollama.ts` detects a RunPod endpoint (when
   `OLLAMA_BASE_URL`'s host is `api.runpod.ai`) and submits a job to `/run`, then
   polls `/status/<id>` until it finishes, within the same 30s budget as the native
   path. No native-API change.

Recommended GPU: 24 GB (fits `qwen2.5:32b`). Max workers 1–2 is plenty for a
low-volume chat; serverless only bills while a worker is actually running.

### Web service settings for RunPod

- `OLLAMA_BASE_URL` → the endpoint URL, `https://api.runpod.ai/v2/<endpoint-id>`.
- `OLLAMA_API_KEY` → the RunPod API key (sent as the bearer token).
- `OLLAMA_MODEL` → the model baked into the worker (e.g. `qwen2.5:32b`).

## Current setup (Render CPU image — the fallback)

`ctf-ollama` is a **private** Render service (no public domain), reachable only by the web service
over Render's internal network at `http://ctf-ollama:11434`. Defined in `render.yaml`
(`dockerfilePath: ctf/ops/ollama/Dockerfile`). Render has no persistent volumes, so the model is
**baked into the image at build time** — present on startup, no runtime pull.

### Changing the model on the Render CPU image

1. Edit the `ARG` in `ctf/ops/ollama/Dockerfile`:
   ```dockerfile
   ARG OLLAMA_MODEL=llama3.2
   ```
   Use any model from the [Ollama library](https://ollama.com/library). Commit and push — Render
   rebuilds the image automatically.
2. After the deploy completes, set `OLLAMA_MODEL` on the web service to match the new name exactly
   (including any tag, e.g. `llama3.2:1b`).

| Model | Approx. image size |
|---|---|
| `llama3.2:1b` | ~1.3 GB |
| `llama3.2` | ~2.0 GB |
| `qwen2.5:3b` | ~1.9 GB |
| `phi3` | ~2.2 GB |
| `mistral` | ~4.1 GB |

On the CPU image, prefer 1B–3B models to keep build times within the platform limit and responses
under the timeout. Larger models belong on the GPU host above.

### How the Dockerfile bakes the model

```dockerfile
RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 2; done && \
    ollama pull ${OLLAMA_MODEL}
```

Ollama must be running to pull. This `RUN` step starts the server in the background, polls until
ready, then pulls the model. When the layer finishes the server process exits, but the model files
written to `/root/.ollama/models/` persist in the image layer. The container then starts fresh with
`ollama serve` and finds the model already on disk.

## Web service configuration

- `OLLAMA_BASE_URL` — `http://ctf-ollama:11434` (Render CPU image) or the GPU host URL.
- `OLLAMA_MODEL` — must exactly match the model name available on the host.
- `OLLAMA_API_KEY` — optional bearer token for an external host behind a proxy; unset otherwise.

## Failure checks

| Symptom | Cause | Fix |
|---|---|---|
| Build times out | Model too large for the build limit | Use a smaller model (`llama3.2:1b`) or move to the GPU host |
| Drafts time out / never arrive | Model too big for the CPU box | Move to the GPU host; check the model fits the GPU's VRAM |
| `ollama list` never returns during build | Server failed to start | Check build logs for port conflicts |
| Chat returns `ollama_http_error:401/403` | Host requires a token | Set `OLLAMA_API_KEY` to match the proxy's expected bearer |
| Chat returns `ollama_http_error` | `OLLAMA_MODEL` ≠ model on the host | Update the web env var to match exactly |
| Chat returns `ollama_not_configured` | `OLLAMA_BASE_URL` not set | Set it to the host URL above |

## Notes

- Never expose Ollama unauthenticated on a public domain — it has no authentication. Keep it on a
  private network or behind a token-checking proxy.
- `ctf/scripts/ollamaModelManager.sh` exists for reference but cannot reach the private service
  remotely; model changes go through the Dockerfile (CPU image) or the host (GPU).
