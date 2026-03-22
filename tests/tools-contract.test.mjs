import test from 'node:test'
import { assertExactTools, listToolNames } from '../../scripts/mcp-contract-test-utils.mjs'

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

test('wdk-wallet-spark-mcp exposes the expected tool contract', async () => {
  const tools = await listToolNames({
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      WDK_SPARK_SEED: TEST_MNEMONIC,
      SPARK_NETWORK: 'REGTEST',
    },
  })

  assertExactTools(tools, [
    'spark_create_lightning_invoice',
    'spark_get_address',
    'spark_get_balance',
    'spark_get_deposit_address',
    'spark_get_token_balance',
    'spark_get_transfers',
    'spark_mpp_pay',
    'spark_pay_lightning_invoice',
    'spark_quote_lightning_payment',
    'spark_quote_withdraw',
    'spark_send_sats',
    'spark_transfer_token',
    'spark_withdraw',
  ])
})
