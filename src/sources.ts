export const STOCK_SOURCES = {
  reddit: {
    label: "Reddit",
    path: "reddit/stocks/v1",
    summary: "Retail investor discussion across stock communities.",
  },
  x: {
    label: "X / FinTwit",
    path: "x/stocks/v1",
    summary: "Cashtag sentiment and attention from market conversations.",
  },
  news: {
    label: "News",
    path: "news/stocks/v1",
    summary: "Financial publisher coverage and market headlines.",
  },
  polymarket: {
    label: "Polymarket",
    path: "polymarket/stocks/v1",
    summary: "Prediction-market activity and probability-implied signals.",
  },
} as const;

export type StockSource = keyof typeof STOCK_SOURCES;

export const DEFAULT_SOURCE: StockSource = "reddit";

export function isStockSource(value: string): value is StockSource {
  return Object.prototype.hasOwnProperty.call(STOCK_SOURCES, value);
}
