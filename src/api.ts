import { STOCK_SOURCES, type StockSource } from "./sources";

const API_BASE_URL = "https://api.adanos.org";

export type SentimentRecord = {
  bearishPct: number | null;
  bullishPct: number | null;
  buzzScore: number | null;
  companyName: string | null;
  marketCount: number | null;
  mentions: number | null;
  sentimentScore: number | null;
  sourceCount: number | null;
  subredditCount: number | null;
  ticker: string;
  totalLiquidity: number | null;
  totalUpvotes: number | null;
  tradeCount: number | null;
  trend: string | null;
  uniquePosts: number | null;
  uniqueTweets: number | null;
  uniqueTraders: number | null;
};

type RawSentimentRecord = {
  bearish_pct?: unknown;
  bullish_pct?: unknown;
  buzz?: unknown;
  buzz_score?: unknown;
  company_name?: unknown;
  market_count?: unknown;
  mentions?: unknown;
  score?: unknown;
  sentiment?: unknown;
  sentiment_score?: unknown;
  source_count?: unknown;
  subreddit_count?: unknown;
  symbol?: unknown;
  ticker?: unknown;
  total_liquidity?: unknown;
  total_upvotes?: unknown;
  trade_count?: unknown;
  trend?: unknown;
  unique_posts?: unknown;
  unique_traders?: unknown;
  unique_tweets?: unknown;
};

type CompareResponse = {
  data?: RawSentimentRecord[];
  results?: RawSentimentRecord[];
  stocks?: RawSentimentRecord[];
};

export type CompareRequest = {
  apiKey: string;
  days: number;
  fetchImpl?: typeof fetch;
  source: StockSource;
  tickers: string[];
};

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRecord(record: RawSentimentRecord): SentimentRecord | null {
  const ticker = toStringValue(record.ticker) ?? toStringValue(record.symbol);
  if (!ticker) return null;

  return {
    bearishPct: toNumber(record.bearish_pct),
    bullishPct: toNumber(record.bullish_pct),
    buzzScore: toNumber(record.buzz_score ?? record.buzz),
    companyName: toStringValue(record.company_name),
    marketCount: toNumber(record.market_count),
    mentions: toNumber(record.mentions),
    sentimentScore: toNumber(record.sentiment_score ?? record.sentiment ?? record.score),
    sourceCount: toNumber(record.source_count),
    subredditCount: toNumber(record.subreddit_count),
    ticker: ticker.replace(/^\$/, "").toUpperCase(),
    totalLiquidity: toNumber(record.total_liquidity),
    totalUpvotes: toNumber(record.total_upvotes),
    tradeCount: toNumber(record.trade_count),
    trend: toStringValue(record.trend),
    uniquePosts: toNumber(record.unique_posts),
    uniqueTweets: toNumber(record.unique_tweets),
    uniqueTraders: toNumber(record.unique_traders),
  };
}

function responseRows(payload: CompareResponse): RawSentimentRecord[] {
  return payload.stocks ?? payload.data ?? payload.results ?? [];
}

export async function compareSentiment({
  apiKey,
  days,
  fetchImpl = fetch,
  source,
  tickers,
}: CompareRequest): Promise<SentimentRecord[]> {
  if (!apiKey.trim()) throw new Error("Add your Adanos API key to continue.");
  if (!tickers.length) throw new Error("Add at least one stock ticker.");

  const endpoint = new URL(`${API_BASE_URL}/${STOCK_SOURCES[source].path}/compare`);
  endpoint.searchParams.set("tickers", tickers.join(","));
  endpoint.searchParams.set("days", String(days));

  const response = await fetchImpl(endpoint, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("The Adanos API key was rejected.");
    if (response.status === 403) throw new Error("This API key does not have access to the requested data.");
    if (response.status === 429) throw new Error("Rate limit reached. Try again later.");
    throw new Error(`Adanos API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as CompareResponse;
  return responseRows(payload)
    .map((record) => normalizeRecord(record))
    .filter((record): record is SentimentRecord => Boolean(record));
}
