# Infisical — Render private service
# Self-hosted secrets manager. Provides secret injection for all CTF v3 services.
# See: https://infisical.com/docs/self-hosting/overview
#
# Required env vars (set in Render dashboard):
#   ENCRYPTION_KEY          — 32-byte hex secret for data-at-rest encryption
#   AUTH_SECRET             — session signing secret (JWT)
#   MONGO_URL               — MongoDB Atlas connection string
#   SITE_URL                — public HTTPS URL of this Infisical service on Render
#   SMTP_HOST / SMTP_PORT   — optional email (for invite flows)
FROM infisical/infisical:v0.160.3@sha256:4f156bb237c7550efdde6789fa61f544250a8931ea849541c7f8efc4f7b7797f

EXPOSE 8080
