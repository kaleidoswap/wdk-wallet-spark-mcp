#!/usr/bin/env node
/**
 * WDK Wallet Spark MCP Server
 *
 * Provides Spark L2 wallet tools (Lightning payments, fee-free token transfers,
 * BTC bridging, Spark invoices) to AI agents via Model Context Protocol.
 *
 * Tools:
 *   spark_get_balance, spark_get_address, spark_get_token_balance
 *   spark_get_deposit_address, spark_create_lightning_invoice
 *   spark_pay_lightning_invoice, spark_quote_lightning_payment
 *   spark_send_sats, spark_transfer_token
 *   spark_quote_withdraw, spark_withdraw
 *   spark_get_transfers, spark_mpp_pay
 *
 * Required env vars:
 *   WDK_SPARK_SEED  — BIP-39 mnemonic (12 or 24 words)
 *
 * Optional env vars:
 *   SPARK_NETWORK          — MAINNET | REGTEST (default: MAINNET)
 *   SPARK_SCAN_API_KEY     — SparkScan API key for enhanced balance queries
 *   SPARK_USDT_TOKEN       — Spark USDT token identifier (btkn1...)
 *   PORT                   — Enable StreamableHTTP on this port (default: stdio)
 *   MCP_AUTH_TOKEN         — Bearer token required for HTTP mode
 *
 * Usage:
 *   WDK_SPARK_SEED="word1 word2 ... word12" node dist/index.js
 *   PORT=3013 WDK_SPARK_SEED="..." node dist/index.js
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './server.js'
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'

const SEED = process.env.WDK_SPARK_SEED ?? ''
const NETWORK = (process.env.SPARK_NETWORK ?? 'MAINNET') as 'MAINNET' | 'REGTEST'
const SPARK_SCAN_API_KEY = process.env.SPARK_SCAN_API_KEY
const USDT_TOKEN = process.env.SPARK_USDT_TOKEN
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : null

if (!SEED) {
  process.stderr.write('[wdk-wallet-spark-mcp] ERROR: WDK_SPARK_SEED env var is required\n')
  process.exit(1)
}

async function main() {
  const mcpServer = createServer({
    seed: SEED,
    network: NETWORK,
    sparkScanApiKey: SPARK_SCAN_API_KEY,
    usdtToken: USDT_TOKEN,
  })

  if (PORT) {
    const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? null
    const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (AUTH_TOKEN) {
        const auth = req.headers['authorization']
        if (auth !== `Bearer ${AUTH_TOKEN}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
      }
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => { transport.close().catch(() => {}) })
      await mcpServer.connect(transport)
      await transport.handleRequest(req, res)
    })
    httpServer.listen(PORT, '0.0.0.0', () => {
      process.stderr.write(
        `[wdk-wallet-spark-mcp] HTTP transport on port ${PORT} — Spark ${NETWORK}\n`,
      )
    })
  } else {
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
    process.stderr.write(
      `[wdk-wallet-spark-mcp] stdio transport connected — Spark ${NETWORK}\n`,
    )
  }
}

main().catch((err) => {
  process.stderr.write(`[wdk-wallet-spark-mcp] Fatal error: ${err}\n`)
  process.exit(1)
})
