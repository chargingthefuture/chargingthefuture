# Ollama Railway Model Management

Date: 2026-05-09
Scope: How models are baked into the Railway-hosted Ollama service via a custom Docker image.

## Architecture

The Ollama service on Railway is **private** (no public domain). It is only reachable by the CTF web service via Railway's internal network at `http://ollama.railway.internal:11434`. Direct external access is intentionally blocked.

Models are baked into the Docker image at build time so they are always present on startup — no runtime pull, no persistent volume required.

---

## Changing the active model

Edit the `ARG` in [ctf/ops/ollama/Dockerfile](../../../ctf/ops/ollama/Dockerfile):

```dockerfile
ARG OLLAMA_MODEL=llama3.2
```

Replace `llama3.2` with any model available on the [Ollama model library](https://ollama.com/library). Then commit and push — Railway rebuilds the image automatically.

After the deploy completes, update `OLLAMA_MODEL` in the Railway **web service** environment variables to match the new model name exactly (including tag if any, e.g. `llama3.2:1b`).

Common models and approximate image size increase:

| Model | Size |
|---|---|
| `llama3.2:1b` | ~1.3 GB |
| `llama3.2` | ~2.0 GB |
| `qwen2.5:3b` | ~1.9 GB |
| `phi3` | ~2.2 GB |
| `mistral` | ~4.1 GB |

Prefer 1B–3B models to keep Railway build times under the timeout limit.

---

## How the Dockerfile works

```dockerfile
RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 2; done && \
    ollama pull ${OLLAMA_MODEL}
```

The Ollama server must be running to pull a model. This `RUN` step starts it in the background, polls until it is ready, then pulls the model. When the layer finishes the server process dies, but the model files written to `/root/.ollama/models/` are preserved in the image layer. The container starts fresh with `ollama serve` and finds the models already on disk.

---

## Railway service configuration

The Ollama Railway service must be configured to build from this Dockerfile instead of pulling `ollama/ollama:latest` directly.

In the Railway dashboard for the **Ollama service**:

1. **Source** — connect to the GitHub repo (same repo as the web service)
2. **Build** → set **Builder** to `Dockerfile`
3. **Dockerfile path** → `ctf/ops/ollama/Dockerfile`
4. **Watch paths** → `ctf/ops/ollama/**` (so pushes outside this path don't trigger a slow rebuild)
5. **Build Arguments** → optionally add `OLLAMA_MODEL=llama3.2` to make the model visible in the Railway UI
6. **Networking** → confirm no public domain is assigned (private network only)

After saving, trigger a manual deploy. The build will pull the model during image construction — expect 5–15 minutes depending on model size.

---

## Common failure checks

| Error | Cause | Fix |
|---|---|---|
| Build times out | Model too large for Railway build limit | Switch to a smaller model (`llama3.2:1b`) |
| `ollama list` never returns | Server failed to start during build | Check Railway build logs for port conflicts |
| Chat returns `ollama_http_error` | `OLLAMA_MODEL` env var on web service doesn't match baked model | Update web service env var to match exactly |
| Chat returns `ollama_not_configured` | `OLLAMA_BASE_URL` not set on web service | Set `OLLAMA_BASE_URL=http://ollama.railway.internal:11434` in web service env |

---

## Notes

- Do not add a public domain to the Ollama service. It has no authentication and should remain private-network only.
- The model management shell script (`ctf/scripts/ollamaModelManager.sh`) exists for reference but cannot reach the private service from Codespaces. Model changes go through the Dockerfile.
