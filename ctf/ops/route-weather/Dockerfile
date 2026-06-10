# Image for the ctf-route-weather Render service.
# No build step and no dependencies — plain ESM on Node's built-in fetch/http.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

# Render injects PORT at runtime; the server reads it (defaults to 3000 locally).
EXPOSE 3000
CMD ["node", "src/server.mjs"]
