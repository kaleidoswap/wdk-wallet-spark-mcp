# wdk-wallet-spark-mcp

MCP server that exposes a Spark wallet to AI agents via the Model Context Protocol.

Provides the canonical `spark_*` tool surface for:

- Spark balance and address lookup
- Lightning receive and pay
- Spark-to-Spark sats transfers
- Spark token transfers
- BTC bridge deposit and withdrawal
- MPP payment execution for paid APIs

## Tools

- `spark_get_balance`
- `spark_get_address`
- `spark_get_token_balance`
- `spark_get_deposit_address`
- `spark_create_lightning_invoice`
- `spark_pay_lightning_invoice`
- `spark_quote_lightning_payment`
- `spark_send_sats`
- `spark_transfer_token`
- `spark_quote_withdraw`
- `spark_withdraw`
- `spark_get_transfers`
- `spark_mpp_pay`

## Configuration

| Env var | Required | Description |
| --- | --- | --- |
| `WDK_SPARK_SEED` | yes | BIP-39 mnemonic for the Spark wallet |
| `SPARK_NETWORK` | no | `MAINNET` or `REGTEST` |
| `SPARK_SCAN_API_KEY` | no | SparkScan API key |
| `SPARK_USDT_TOKEN` | no | Default Spark token identifier |
| `PORT` | no | Enable Streamable HTTP transport |
| `MCP_AUTH_TOKEN` | no | Bearer token for HTTP mode |

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# stdio
WDK_SPARK_SEED="word1 word2 ..." node dist/index.js

# HTTP
PORT=3013 WDK_SPARK_SEED="word1 word2 ..." node dist/index.js
```
