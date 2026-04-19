import { describe, expect, it } from "vitest";

import { normalizeTicker, parseTickerList } from "../src/tickers";

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
});

