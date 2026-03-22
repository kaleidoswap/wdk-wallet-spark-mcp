# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY wdk-wallet-spark-mcp/package*.json ./wdk-wallet-spark-mcp/
RUN cd wdk-wallet-spark-mcp && npm install
COPY wdk-wallet-spark-mcp/ ./wdk-wallet-spark-mcp/
RUN cd wdk-wallet-spark-mcp && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/wdk-wallet-spark-mcp/dist ./dist/
COPY --from=builder /workspace/wdk-wallet-spark-mcp/package.json ./
RUN npm install --omit=dev

EXPOSE 3014

ENV PORT=3014
# WDK_SPARK_SEED must be set at runtime — BIP-39 mnemonic (12 or 24 words)
ENV WDK_SPARK_SEED=
ENV SPARK_NETWORK=MAINNET

CMD ["node", "dist/index.js"]
