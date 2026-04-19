export const MAX_COMPARE_TICKERS = 10;

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;
const TICKER_SCAN_PATTERN = /(^|[^A-Za-z0-9.])(\$?[A-Z][A-Z0-9]{0,4}(?:\.[A-Z])?)(?![A-Za-z0-9.])/g;

const EXCLUDED_SCAN_WORDS = new Set([
  "API",
  "CEO",
  "CFO",
  "COO",
  "ETF",
  "GDP",
  "IPO",
  "NYSE",
  "SEC",
  "USD",
  "USA",
  "THE",
  "AND",
  "FOR",
  "FROM",
  "WITH",
]);

const AMBIGUOUS_SCAN_TICKERS = new Set(["AI", "ARE", "CAN", "IT", "ON", "OR", "SO", "TO", "US"]);

export type TickerMention = {
  end: number;
  start: number;
  ticker: string;
};

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

function isLikelyTicker(rawValue: string, ticker: string): boolean {
  const hasDollarPrefix = rawValue.startsWith("$");
  if (EXCLUDED_SCAN_WORDS.has(ticker)) return false;
  if (!hasDollarPrefix && ticker.length === 1) return false;
  if (!hasDollarPrefix && AMBIGUOUS_SCAN_TICKERS.has(ticker)) return false;
  return true;
}

export function findTickerMentions(text: string, limit = 50): TickerMention[] {
  const mentions: TickerMention[] = [];

  for (const match of text.matchAll(TICKER_SCAN_PATTERN)) {
    const prefix = match[1] ?? "";
    const rawValue = match[2] ?? "";
    const ticker = normalizeTicker(rawValue);
    if (!ticker || !isLikelyTicker(rawValue, ticker)) continue;

    const start = match.index + prefix.length;
    mentions.push({
      end: start + rawValue.length,
      start,
      ticker,
    });

    if (mentions.length >= limit) break;
  }

  return mentions;
}
