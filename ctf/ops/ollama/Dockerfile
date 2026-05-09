FROM ollama/ollama:latest

# Override at build time to bake a different model:
#   docker build --build-arg OLLAMA_MODEL=llama3.2:1b .
# Or in Railway: set OLLAMA_MODEL as a Build Argument on the service.
ARG OLLAMA_MODEL=llama3.2

# Start the server in the background, wait until it accepts connections,
# pull the model, then let the server die. The downloaded model files
# written to /root/.ollama/models/ are preserved in this image layer and
# will be present when the container starts for real.
RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 2; done && \
    ollama pull ${OLLAMA_MODEL}

EXPOSE 11434
