# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/dist ./dist/
COPY --from=builder /workspace/package.json ./
RUN npm install --omit=dev

EXPOSE 3014

ENV PORT=3014
# WDK_SPARK_SEED must be set at runtime — BIP-39 mnemonic (12 or 24 words)
ENV WDK_SPARK_SEED=
ENV SPARK_NETWORK=MAINNET

CMD ["node", "dist/index.js"]
