import { describe, expect, it } from "vitest";

import { findTickerMentions, normalizeTicker, parseTickerList } from "../src/tickers";

describe("ticker parsing", () => {
  it("normalizes stock ticker selections", () => {
    expect(normalizeTicker(" $nvda ")).toBe("NVDA");
    expect(normalizeTicker("BRK.B")).toBe("BRK.B");
  });

  it("rejects invalid ticker strings", () => {
    expect(normalizeTicker("")).toBeNull();
    expect(normalizeTicker("$")).toBeNull();
    expect(normalizeTicker("too-long-ticker")).toBeNull();
    expect(normalizeTicker("1234")).toBeNull();
  });

  it("deduplicates and limits compare inputs", () => {
    expect(parseTickerList("aapl, AAPL; nvda tsla meta amzn msft goog avgo amd nflx pltr")).toEqual([
      "AAPL",
      "NVDA",
      "TSLA",
      "META",
      "AMZN",
      "MSFT",
      "GOOG",
      "AVGO",
      "AMD",
      "NFLX",
    ]);
  });

  it("finds likely ticker mentions in page text", () => {
    expect(findTickerMentions("NVDA rallied while $TSLA lagged and BRK.B stayed flat.")).toEqual([
      { start: 0, end: 4, ticker: "NVDA" },
      { start: 19, end: 24, ticker: "TSLA" },
      { start: 36, end: 41, ticker: "BRK.B" },
    ]);
  });

  it("avoids common uppercase false positives while allowing prefixed ambiguous tickers", () => {
    expect(findTickerMentions("The API is for US users and $AI remains valid.")).toEqual([
      { start: 28, end: 31, ticker: "AI" },
    ]);
  });
});
