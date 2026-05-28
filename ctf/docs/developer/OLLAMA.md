# Ollama Model Management

How the self-hosted Ollama service works on Render and how to change its model.

## Architecture

`ctf-ollama` is a **private** Render service (no public domain), reachable only
by the CTF web service over Render's internal network at
`http://ctf-ollama:11434`. Defined in `render.yaml`
(`dockerfilePath: ctf/ops/ollama/Dockerfile`).

Render has no persistent volumes, so the model is **baked into the image at
build time** — always present on startup, no runtime pull.

## Changing the active model

1. Edit the `ARG` in `ctf/ops/ollama/Dockerfile`:
   ```dockerfile
   ARG OLLAMA_MODEL=llama3.2
   ```
   Use any model from the [Ollama library](https://ollama.com/library). Commit
   and push — Render rebuilds the image automatically.
2. After the deploy completes, set `OLLAMA_MODEL` on the **web service** to match
   the new name exactly (including any tag, e.g. `llama3.2:1b`).

| Model | Approx. image size |
|---|---|
| `llama3.2:1b` | ~1.3 GB |
| `llama3.2` | ~2.0 GB |
| `qwen2.5:3b` | ~1.9 GB |
| `phi3` | ~2.2 GB |
| `mistral` | ~4.1 GB |

Prefer 1B–3B models to keep build times within the platform limit.

## How the Dockerfile bakes the model

```dockerfile
RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 2; done && \
    ollama pull ${OLLAMA_MODEL}
```

Ollama must be running to pull. This `RUN` step starts the server in the
background, polls until ready, then pulls the model. When the layer finishes the
server process exits, but the model files written to `/root/.ollama/models/`
persist in the image layer. The container then starts fresh with `ollama serve`
and finds the model already on disk.

## Web service configuration

- `OLLAMA_BASE_URL=http://ctf-ollama:11434`
- `OLLAMA_MODEL` must exactly match the baked model name.

## Failure checks

| Symptom | Cause | Fix |
|---|---|---|
| Build times out | Model too large for the build limit | Use a smaller model (`llama3.2:1b`) |
| `ollama list` never returns during build | Server failed to start | Check build logs for port conflicts |
| Chat returns `ollama_http_error` | `OLLAMA_MODEL` on web service ≠ baked model | Update the web env var to match exactly |
| Chat returns `ollama_not_configured` | `OLLAMA_BASE_URL` not set | Set it to the internal URL above |

## Notes

- Never assign a public domain to the Ollama service — it has no authentication and must stay private-network only.
- `ctf/scripts/ollamaModelManager.sh` exists for reference but cannot reach the private service remotely; model changes go through the Dockerfile.
