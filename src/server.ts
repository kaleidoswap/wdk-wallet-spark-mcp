import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
// @ts-ignore — wdk-wallet-spark ships CJS types but ESM runtime; skipLibCheck covers this
import WalletManagerSpark from '@tetherto/wdk-wallet-spark'

export interface SparkServerConfig {
  seed: string
  network: 'MAINNET' | 'REGTEST'
  sparkScanApiKey?: string
  /** USDT token identifier on Spark (btkn1... format). Set via SPARK_USDT_TOKEN env. */
  usdtToken?: string
}

export function createServer(config: SparkServerConfig): McpServer {
  const walletManager = new WalletManagerSpark(config.seed, {
    network: config.network,
    ...(config.sparkScanApiKey ? { sparkScanApiKey: config.sparkScanApiKey } : {}),
  })

  // Lazily initialized — derived once and reused for the process lifetime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _account: any = null
  const getAccount = async () => {
    if (!_account) _account = await walletManager.getAccount(0)
    return _account
  }

  const server = new McpServer({
    name: 'wdk-wallet-spark',
    version: '1.0.0',
  })

  // -----------------------------------------------------------------------
  // Tool: spark_get_balance
  // -----------------------------------------------------------------------
  server.tool(
    'spark_get_balance',
    'Get the Spark L2 wallet balance in satoshis. Spark transactions are fee-free. Use this to check available BTC on Spark before making payments or swaps via Lightning.',
    {},
    async () => {
      const account = await getAccount()
      const balanceSats = await account.getBalance()
      return text(
        JSON.stringify(
          {
            balance_sats: Number(balanceSats),
            balance_btc: Number(balanceSats) / 1e8,
            network: config.network,
            note: 'Spark L2 balance — fee-free transfers on Spark network',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_get_address
  // -----------------------------------------------------------------------
  server.tool(
    'spark_get_address',
    'Get the Spark L2 address for this wallet. Use this to receive sats or tokens directly on Spark from another Spark wallet (fee-free).',
    {},
    async () => {
      const account = await getAccount()
      const address = await account.getAddress()
      return text(JSON.stringify({ spark_address: address, network: config.network }, null, 2))
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_get_token_balance
  // -----------------------------------------------------------------------
  server.tool(
    'spark_get_token_balance',
    'Get the balance of a Spark token (e.g. USDT) by its token identifier. Returns balance as a bigint string. Use SPARK_USDT_TOKEN env var or pass the token address directly.',
    {
      token: z
        .string()
        .optional()
        .describe(
          'Spark token identifier (e.g. btkn1...). Omit to use the configured USDT token.',
        ),
    },
    async ({ token }) => {
      const tokenAddr = token ?? config.usdtToken
      if (!tokenAddr) {
        return text(
          JSON.stringify(
            {
              error: 'No token provided. Pass a token identifier or set SPARK_USDT_TOKEN env var.',
            },
            null,
            2,
          ),
        )
      }
      const account = await getAccount()
      const balance = await account.getTokenBalance(tokenAddr)
      return text(
        JSON.stringify({ token, balance: balance.toString(), network: config.network }, null, 2),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_get_deposit_address
  // -----------------------------------------------------------------------
  server.tool(
    'spark_get_deposit_address',
    'Generate a Bitcoin L1 address to deposit BTC into this Spark L2 wallet. Funds sent to this address are bridged to Spark automatically. Use spark_static_deposit_address for a reusable address.',
    {
      reusable: z
        .boolean()
        .optional()
        .describe(
          'If true, returns the static (reusable) deposit address instead of a single-use one (default: false)',
        ),
    },
    async ({ reusable = false }) => {
      const account = await getAccount()
      const address = reusable
        ? await account.getStaticDepositAddress()
        : await account.getSingleUseDepositAddress()
      return text(
        JSON.stringify(
          {
            btc_l1_deposit_address: address,
            type: reusable ? 'static_reusable' : 'single_use',
            network: config.network,
            note: 'Send BTC on-chain to this address — it will be bridged to your Spark L2 wallet',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_create_lightning_invoice
  // -----------------------------------------------------------------------
  server.tool(
    'spark_create_lightning_invoice',
    'Create a BOLT11 Lightning invoice to receive BTC into this Spark wallet via Lightning Network. The received sats land in the Spark L2 balance. This is ideal for receiving KaleidoSwap BTC payouts.',
    {
      amount_sats: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Amount in satoshis. Omit for a zero-amount (any-amount) invoice.'),
      memo: z.string().optional().describe('Invoice description / memo'),
    },
    async ({ amount_sats, memo }) => {
      const account = await getAccount()
      const req = await account.createLightningInvoice({
        ...(amount_sats !== undefined ? { amountSats: amount_sats } : {}),
        ...(memo ? { memo } : {}),
      })
      return text(
        JSON.stringify(
          {
            invoice: req.invoice,
            id: req.id,
            amount_sats: req.amountSats ?? amount_sats ?? null,
            memo: memo ?? null,
            note: 'Pay this BOLT11 invoice from any Lightning wallet to receive into Spark',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_pay_lightning_invoice
  // -----------------------------------------------------------------------
  server.tool(
    'spark_pay_lightning_invoice',
    'Pay a BOLT11 Lightning invoice from this Spark wallet. Use this to pay KaleidoSwap deposit invoices (BTC→USDT swap funding) directly from Spark L2 — no Lightning channel needed on Spark side.',
    {
      invoice: z
        .string()
        .describe('BOLT11 Lightning invoice string (starts with lnbc... or lntb...)'),
      max_fee_sats: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum fee in satoshis willing to pay (default: no limit)'),
    },
    async ({ invoice, max_fee_sats }) => {
      const account = await getAccount()
      const req = await account.payLightningInvoice({
        encodedInvoice: invoice,
        ...(max_fee_sats !== undefined ? { maxFeeSats: max_fee_sats } : {}),
      })
      return text(
        JSON.stringify(
          {
            id: req.id,
            invoice: req.invoice,
            status: req.status,
            max_fee_sats: req.maxFeeSats ?? null,
            note: 'Lightning payment initiated from Spark L2',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_quote_lightning_payment
  // -----------------------------------------------------------------------
  server.tool(
    'spark_quote_lightning_payment',
    'Estimate the Lightning Network fee for paying a BOLT11 invoice from Spark. Returns fee in satoshis. Call this before spark_pay_lightning_invoice if you need cost prediction.',
    {
      invoice: z.string().describe('BOLT11 invoice to quote'),
    },
    async ({ invoice }) => {
      const account = await getAccount()
      const feeSats = await account.quotePayLightningInvoice({ encodedInvoice: invoice })
      return text(
        JSON.stringify({ estimated_fee_sats: Number(feeSats), invoice }, null, 2),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_send_sats
  // -----------------------------------------------------------------------
  server.tool(
    'spark_send_sats',
    'Send satoshis to another Spark L2 address. Spark transfers are completely fee-free. Use this for direct Spark-to-Spark sats movement.',
    {
      to: z.string().describe('Destination Spark address (spark1...)'),
      amount_sats: z.number().int().positive().describe('Amount in satoshis to send'),
    },
    async ({ to, amount_sats }) => {
      const account = await getAccount()
      const result = await account.sendTransaction({ to, value: amount_sats })
      return text(
        JSON.stringify(
          {
            hash: result.hash,
            fee_sats: Number(result.fee),
            sent_sats: amount_sats,
            to,
            note: 'Spark L2 transfer — fee-free',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_transfer_token
  // -----------------------------------------------------------------------
  server.tool(
    'spark_transfer_token',
    'Transfer a Spark token (e.g. USDT) to another Spark address. Fee-free. Use this to send USDT on Spark L2 without any transaction fees.',
    {
      to: z.string().describe('Destination Spark address (spark1...)'),
      amount: z
        .string()
        .describe('Amount to send as a string integer (base units, e.g. "1000000" for 1 USDT with 6 decimals)'),
      token: z
        .string()
        .optional()
        .describe('Spark token identifier. Omit to use the configured USDT token (SPARK_USDT_TOKEN).'),
    },
    async ({ to, amount, token }) => {
      const tokenAddr = token ?? config.usdtToken
      if (!tokenAddr) {
        return text(
          JSON.stringify(
            { error: 'No token provided. Pass token or set SPARK_USDT_TOKEN env var.' },
            null,
            2,
          ),
        )
      }
      const account = await getAccount()
      const result = await account.transfer({
        token: tokenAddr,
        amount: BigInt(amount),
        recipient: to,
      })
      return text(
        JSON.stringify(
          {
            hash: result.hash,
            fee: result.fee.toString(),
            token: tokenAddr,
            amount,
            to,
            note: 'Spark token transfer — fee-free',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_quote_withdraw
  // -----------------------------------------------------------------------
  server.tool(
    'spark_quote_withdraw',
    'Get a fee quote for withdrawing BTC from Spark L2 back to Bitcoin L1. Returns the fee amount and exit speed. Call this before spark_withdraw.',
    {
      onchain_address: z.string().describe('Destination Bitcoin L1 address'),
      amount_sats: z.number().int().positive().describe('Amount in satoshis to withdraw'),
    },
    async ({ onchain_address, amount_sats }) => {
      const account = await getAccount()
      const quote = await account.quoteWithdraw({
        withdrawalAddress: onchain_address,
        amountSats: amount_sats,
      })
      return text(JSON.stringify({ ...quote, onchain_address, amount_sats }, null, 2))
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_withdraw
  // -----------------------------------------------------------------------
  server.tool(
    'spark_withdraw',
    'Withdraw BTC from Spark L2 to a Bitcoin L1 address (cooperative exit). Use spark_quote_withdraw first to check fees. Withdrawal settles on-chain within a few blocks.',
    {
      onchain_address: z.string().describe('Destination Bitcoin L1 address'),
      amount_sats: z.number().int().positive().describe('Amount in satoshis to withdraw'),
    },
    async ({ onchain_address, amount_sats }) => {
      const account = await getAccount()
      const result = await account.withdraw({ onchainAddress: onchain_address, amountSats: amount_sats })
      return text(
        JSON.stringify(
          {
            ...result,
            requested_amount_sats: amount_sats,
            onchain_address,
            note: 'Cooperative exit to Bitcoin L1 initiated',
          },
          null,
          2,
        ),
      )
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_get_transfers
  // -----------------------------------------------------------------------
  server.tool(
    'spark_get_transfers',
    'List recent Spark L2 transfer history including Lightning payments, token transfers, and BTC bridge events.',
    {
      direction: z
        .enum(['all', 'incoming', 'outgoing'])
        .optional()
        .describe("Filter direction (default: 'all')"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum number of transfers to return (default: 20)'),
    },
    async ({ direction = 'all', limit = 20 }) => {
      const account = await getAccount()
      const transfers = await account.getTransfers({ direction, limit, skip: 0 })
      return text(JSON.stringify({ count: transfers.length, transfers }, null, 2))
    },
  )

  // -----------------------------------------------------------------------
  // Tool: spark_mpp_pay
  // -----------------------------------------------------------------------
  server.tool(
    'spark_mpp_pay',
    'Pay an MPP (Machine Payments Protocol) Lightning challenge from the Spark wallet. Pass the invoice from mpp_request_challenge. Returns a credential JSON string for mpp_submit_credential. Lets Spark wallet access 402-gated APIs (402index.io, premium data feeds) via Lightning micropayments.',
    {
      invoice: z
        .string()
        .describe('BOLT11 Lightning invoice from the MPP challenge (from mpp_request_challenge)'),
      challenge_id: z
        .string()
        .optional()
        .describe('MPP challenge_id (included in credential for server verification)'),
      macaroon: z
        .string()
        .optional()
        .describe('Macaroon from mpp_request_challenge (for L402-compatible servers)'),
      max_fee_sats: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum Lightning routing fee in satoshis'),
    },
    async ({ invoice, challenge_id, macaroon, max_fee_sats }) => {
      const account = await getAccount()
      const req = await account.payLightningInvoice({
        encodedInvoice: invoice,
        ...(max_fee_sats !== undefined ? { maxFeeSats: max_fee_sats } : {}),
      })

      // Spark SDK returns a LightningSendRequest — extract request id as payment proof
      const credential: Record<string, string> = { method: 'lightning' }
      if (challenge_id) credential.challenge_id = challenge_id
      if (req.id) credential.payment_id = req.id   // Spark payment request ID
      if (macaroon) credential.macaroon = macaroon

      return text(
        JSON.stringify(
          {
            paid: true,
            payment_id: req.id,
            status: req.status,
            credential: JSON.stringify(credential),
            note: 'Credential ready — pass to mpp_submit_credential. Spark payments settle near-instantly.',
          },
          null,
          2,
        ),
      )
    },
  )

  return server
}

// ---------------------------------------------------------------------------

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] }
}
