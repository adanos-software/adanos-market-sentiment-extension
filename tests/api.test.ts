import { describe, expect, it, vi } from "vitest";

import { compareSentiment } from "../src/api";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("Adanos API client", () => {
  it("calls the selected stock source compare endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        stocks: [
          {
            bearish_pct: 22,
            bullish_pct: 51,
            buzz_score: 74.2,
            company_name: "NVIDIA Corporation",
            mentions: 183,
            sentiment_score: 0.34,
            source_count: 12,
            ticker: "NVDA",
            trend: "rising",
            trend_history: ["61", 64, null, "67.5"],
          },
        ],
      }),
    );

    const results = await compareSentiment({
      apiKey: "sk_live_test",
      days: 7,
      fetchImpl: fetchMock as unknown as typeof fetch,
      source: "news",
      tickers: ["NVDA", "TSLA"],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(String(url)).toBe("https://api.adanos.org/news/stocks/v1/compare?tickers=NVDA%2CTSLA&days=7");
    expect(init?.headers).toMatchObject({ "X-API-Key": "sk_live_test" });
    expect(results[0]).toMatchObject({
      buzzScore: 74.2,
      companyName: "NVIDIA Corporation",
      sentimentScore: 0.34,
      ticker: "NVDA",
      trend: "rising",
      trendHistory: [61, 64, 67.5],
    });
  });

  it("accepts alternative response row envelopes and field aliases", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        data: [{ buzz: "52", score: "-0.12", symbol: "$TSLA" }],
      }),
    );

    const results = await compareSentiment({
      apiKey: "sk_live_test",
      days: 3,
      fetchImpl: fetchMock as unknown as typeof fetch,
      source: "reddit",
      tickers: ["TSLA"],
    });

    expect(results).toEqual([
      expect.objectContaining({
        buzzScore: 52,
        sentimentScore: -0.12,
        ticker: "TSLA",
      }),
    ]);
  });

  it("normalizes source-specific activity fields", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        stocks: [
          {
            ticker: "AAPL",
            trade_count: 14,
            market_count: 4,
            unique_traders: 8,
            total_liquidity: 21000,
            sentiment_score: 0.12,
          },
        ],
      }),
    );

    const results = await compareSentiment({
      apiKey: "sk_live_test",
      days: 7,
      fetchImpl: fetchMock as unknown as typeof fetch,
      source: "polymarket",
      tickers: ["AAPL"],
    });

    expect(results[0]).toMatchObject({
      marketCount: 4,
      ticker: "AAPL",
      totalLiquidity: 21000,
      tradeCount: 14,
      uniqueTraders: 8,
    });
  });

  it("returns helpful errors for common API failures", async () => {
    await expect(
      compareSentiment({
        apiKey: "sk_live_test",
        days: 7,
        fetchImpl: vi.fn(async () => response({}, { status: 429 })) as unknown as typeof fetch,
        source: "x",
        tickers: ["AAPL"],
      }),
    ).rejects.toThrow("Rate limit reached");
  });

  it("requires an API key and at least one ticker", async () => {
    await expect(compareSentiment({ apiKey: "", days: 7, source: "news", tickers: [] })).rejects.toThrow(
      "Add your Adanos API key",
    );
    await expect(compareSentiment({ apiKey: "sk_live_test", days: 7, source: "news", tickers: [] })).rejects.toThrow(
      "Add at least one stock ticker",
    );
  });
});
