# Railway build for the MPL Asset Inventory.
# The full application source is in app.zip (keeps the GitHub upload to 3 files).

# ── Build ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY app.zip .
RUN unzip -q app.zip && rm app.zip
WORKDIR /src/mpl-inventory
RUN npm ci && npm run build

# ── Runtime ──────────────────────────────────────────────
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src/mpl-inventory ./
EXPOSE 3000
CMD ["npm", "start"]
