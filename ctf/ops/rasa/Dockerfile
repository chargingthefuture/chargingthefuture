# Custom image for the `ctf-rasa` Render service — the NLU brain for the "AI Assistant" (@comic).
#
# Mirrors the ctf-ollama pattern: the model is BAKED IN AT BUILD TIME so it is always present on
# startup (Render has no persistent volumes). Here "baking" means running `rasa train nlu` during
# the build and shipping the resulting model tarball inside the image. At runtime the container
# serves the stateless NLU HTTP API (`POST /model/parse`) that the comic backend calls.
#
# Pin a concrete Rasa 3.x release (not a floating tag) so rebuilds are reproducible. The official
# rasa/rasa image already contains Rasa Open Source + its Python deps.
#
# Build:  docker build -t ghcr.io/chargingthefuture/ctf-rasa:latest ctf/ops/rasa
# (CI builds + pushes this automatically when ctf/ops/rasa/** changes — see build-images.yml.)
FROM rasa/rasa:3.6.21

# The base image runs as the unprivileged `1001` user with `rasa` as its ENTRYPOINT. Switch to
# root only to copy files into the image and train, then drop back to the non-root user to run.
USER root

WORKDIR /app

# Copy the whole NLU project (config.yml, domain.yml, data/, credentials.yml, endpoints.yml).
COPY . /app

# Train the NLU model at build time. The trained model tarball is written to /app/models/ and is
# preserved in this image layer, so the runtime container starts with the model already on disk and
# never needs to train (or reach the network) on boot. `--num-threads 1` keeps the build within the
# CI runner's resource envelope. Override the ENTRYPOINT for this one RUN so we can call `rasa`
# with the `train` subcommand explicitly.
RUN ["rasa", "train", "nlu", "--num-threads", "1"]

# Make sure the non-root runtime user owns the project + baked model.
RUN chown -R 1001:1001 /app

EXPOSE 5005

# Drop back to the unprivileged user the base image ships with.
USER 1001

# The base image's ENTRYPOINT is `rasa`; CMD supplies the subcommand + flags:
#   run            — start the server
#   --enable-api   — expose the HTTP API, including the stateless NLU `POST /model/parse`
#   -p 5005        — listen on the documented internal port
#   --cors "*"     — allow cross-origin (the caller is a server-side fetch on the private network;
#                    harmless and avoids surprises if tested from a browser tool)
# Render injects PORT, but Rasa is reached at the fixed internal URL http://ctf-rasa:5005, so the
# port is pinned to 5005 here to match RASA_BASE_URL on the web service.
CMD ["run", "--enable-api", "-p", "5005", "--cors", "*"]
