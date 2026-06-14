# RunPod Serverless worker that serves an Ollama model behind RunPod's job API.
#
# Point a RunPod Serverless endpoint's GitHub build at this Dockerfile
# (Dockerfile path: ctf/ops/runpod-ollama/Dockerfile). The web app talks to the
# endpoint via lib/chatbot/ollama.ts when OLLAMA_BASE_URL is the endpoint URL
# (https://api.runpod.ai/v2/<id>) and OLLAMA_API_KEY is the RunPod API key.
#
# The handler is written inline (no COPY) so the build does not depend on
# RunPod's build-context root. See ctf/docs/developer/OLLAMA.md.

FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir runpod requests

# Bake the model into the image so a cold start does not also pay a model
# download. qwen2.5:32b (~20 GB quantized) fits a 24 GB GPU; override with
# --build-arg OLLAMA_MODEL=... (e.g. llama3.3 on a 48 GB GPU).
ARG OLLAMA_MODEL=qwen2.5:32b
ENV OLLAMA_MODEL=${OLLAMA_MODEL}
RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 2; done && \
    ollama pull ${OLLAMA_MODEL}

RUN printf '%s\n' \
    'import os, subprocess, time' \
    'import requests' \
    'import runpod' \
    '' \
    'OLLAMA_HOST = "http://127.0.0.1:11434"' \
    'MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:32b")' \
    '' \
    '# Start Ollama once per worker (on cold start), then wait until it answers.' \
    'subprocess.Popen(["ollama", "serve"])' \
    'for _ in range(120):' \
    '    try:' \
    '        requests.get(f"{OLLAMA_HOST}/api/tags", timeout=2)' \
    '        break' \
    '    except Exception:' \
    '        time.sleep(1)' \
    '' \
    '' \
    'def handler(job):' \
    '    data = job.get("input", {}) or {}' \
    '    messages = data.get("messages")' \
    '    if not messages:' \
    '        messages = [{"role": "user", "content": data.get("prompt", "")}]' \
    '    options = data.get("options", {"temperature": 0.4, "num_predict": 600})' \
    '    resp = requests.post(' \
    '        f"{OLLAMA_HOST}/api/chat",' \
    '        json={' \
    '            "model": data.get("model", MODEL),' \
    '            "messages": messages,' \
    '            "stream": False,' \
    '            "options": options,' \
    '        },' \
    '        timeout=300,' \
    '    )' \
    '    resp.raise_for_status()' \
    '    body = resp.json()' \
    '    return {' \
    '        "content": body.get("message", {}).get("content", ""),' \
    '        "model": body.get("model", MODEL),' \
    '    }' \
    '' \
    '' \
    'runpod.serverless.start({"handler": handler})' \
    > /handler.py

# The base image's entrypoint is `ollama`; reset it so the handler runs.
ENTRYPOINT []
CMD ["python3", "-u", "/handler.py"]
