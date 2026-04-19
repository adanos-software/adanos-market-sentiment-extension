export const MAX_COMPARE_TICKERS = 10;

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;

export function normalizeTicker(input: string): string | null {
  const ticker = input.trim().replace(/^\$/, "").toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) return null;
  return ticker;
}

export function parseTickerList(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(/[\s,;]+/)
    .map((value) => normalizeTicker(value))
    .filter((ticker): ticker is string => Boolean(ticker))
    .filter((ticker) => {
      if (seen.has(ticker)) return false;
      seen.add(ticker);
      return true;
    })
    .slice(0, MAX_COMPARE_TICKERS);
}

