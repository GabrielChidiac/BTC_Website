import type { Result } from "@/lib/types";
import { MEMPOOL_BASE } from "@/lib/constants";
import { fetchWithTimeout } from "./fetch-timeout";

export async function fetchMempoolData(): Promise<
  Result<{
    hashrate_eh_s: number;
    difficulty: number;
    block_height: number;
    mempool_tx_count: number;
    mempool_size_mb: number;
    fee_fast_sat_vb: number;
    fee_medium_sat_vb: number;
    fee_slow_sat_vb: number;
  }>
> {
  try {
    const [hashrateRes, difficultyRes, blockHeightRes, mempoolRes, feesRes] =
      await Promise.allSettled([
        fetchWithTimeout(`${MEMPOOL_BASE}/v1/mining/hashrate/1w`),
        fetchWithTimeout(`${MEMPOOL_BASE}/v1/difficulty-adjustment`),
        fetchWithTimeout(`${MEMPOOL_BASE}/blocks/tip/height`),
        fetchWithTimeout(`${MEMPOOL_BASE}/mempool`),
        fetchWithTimeout(`${MEMPOOL_BASE}/v1/fees/recommended`),
      ]);

    // Parse hashrate + difficulty from the same endpoint
    // /v1/mining/hashrate/1w returns { currentHashrate, currentDifficulty, ... }
    let hashrate_eh_s = 0;
    let difficulty = 0;
    if (hashrateRes.status === "fulfilled" && hashrateRes.value.ok) {
      const json = await hashrateRes.value.json();
      const latest = json.currentHashrate ?? json.hashrates?.[json.hashrates.length - 1]?.avgHashrate ?? 0;
      hashrate_eh_s = latest / 1e18;
      difficulty = json.currentDifficulty ?? 0;
    }

    // difficultyRes is now unused for the raw difficulty value but kept
    // in case we want difficultyChange (%) or remainingBlocks later
    void difficultyRes;

    // Parse block height
    let block_height = 0;
    if (blockHeightRes.status === "fulfilled" && blockHeightRes.value.ok) {
      block_height = Number(await blockHeightRes.value.text());
    }

    // Parse mempool stats
    let mempool_tx_count = 0;
    let mempool_size_mb = 0;
    if (mempoolRes.status === "fulfilled" && mempoolRes.value.ok) {
      const json = await mempoolRes.value.json();
      mempool_tx_count = json.count ?? 0;
      mempool_size_mb = (json.vsize ?? 0) / 1_000_000;
    }

    // Parse fees
    let fee_fast_sat_vb = 0;
    let fee_medium_sat_vb = 0;
    let fee_slow_sat_vb = 0;
    if (feesRes.status === "fulfilled" && feesRes.value.ok) {
      const json = await feesRes.value.json();
      fee_fast_sat_vb = json.fastestFee ?? 0;
      fee_medium_sat_vb = json.halfHourFee ?? 0;
      fee_slow_sat_vb = json.economyFee ?? 0;
    }

    return {
      data: {
        hashrate_eh_s,
        difficulty,
        block_height,
        mempool_tx_count,
        mempool_size_mb,
        fee_fast_sat_vb,
        fee_medium_sat_vb,
        fee_slow_sat_vb,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[mempool] ${(e as Error).message}` };
  }
}
