import type { Result } from "@/lib/types";
import { RSI, SMA } from "trading-signals";

export function calculateIndicators(
  closingPrices: number[]
): Result<{
  rsi_14: number;
  sma_50: number;
  sma_200: number;
}> {
  try {
    if (closingPrices.length < 200) {
      return {
        data: null,
        error: `[technical-indicators] Need at least 200 data points, got ${closingPrices.length}`,
      };
    }

    const rsi = new RSI(14);
    const sma50 = new SMA(50);
    const sma200 = new SMA(200);

    for (const price of closingPrices) {
      rsi.update(price, false);
      sma50.update(price, false);
      sma200.update(price, false);
    }

    return {
      data: {
        rsi_14: Math.round(Number(rsi.getResult()) * 100) / 100,
        sma_50: Math.round(Number(sma50.getResult()) * 100) / 100,
        sma_200: Math.round(Number(sma200.getResult()) * 100) / 100,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[technical-indicators] ${(e as Error).message}` };
  }
}
