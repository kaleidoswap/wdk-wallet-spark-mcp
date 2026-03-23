# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && npm prune --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app

COPY --from=builder /workspace/dist ./dist/
COPY --from=builder /workspace/package.json ./
COPY --from=builder /workspace/node_modules ./node_modules/

EXPOSE 3014

ENV PORT=3014
# WDK_SPARK_SEED must be set at runtime — BIP-39 mnemonic (12 or 24 words)
ENV WDK_SPARK_SEED=
ENV SPARK_NETWORK=MAINNET

CMD ["node", "dist/index.js"]
