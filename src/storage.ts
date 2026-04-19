import { DEFAULT_SOURCE, isStockSource, type StockSource } from "./sources";

const STORAGE_KEY = "adanos.sentimentLens.settings";
const CONTEXT_TICKER_KEY = "adanos.sentimentLens.contextTicker";

export type Settings = {
  apiKey: string;
  days: number;
  onboardingComplete: boolean;
  source: StockSource;
  watchlist: string[];
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  days: 7,
  onboardingComplete: false,
  source: DEFAULT_SOURCE,
  watchlist: ["NVDA", "TSLA", "AAPL"],
};

type ChromeStorageArea = {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function storageArea(): ChromeStorageArea {
  return chrome.storage.local;
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<Settings>;
  const days = Number(candidate.days);

  return {
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : DEFAULT_SETTINGS.apiKey,
    days: Number.isInteger(days) && days >= 1 && days <= 365 ? days : DEFAULT_SETTINGS.days,
    onboardingComplete: Boolean(candidate.onboardingComplete),
    source:
      typeof candidate.source === "string" && isStockSource(candidate.source) ? candidate.source : DEFAULT_SETTINGS.source,
    watchlist: Array.isArray(candidate.watchlist)
      ? candidate.watchlist.filter((ticker): ticker is string => typeof ticker === "string")
      : DEFAULT_SETTINGS.watchlist,
  };
}

export async function loadSettings(): Promise<Settings> {
  const result = await storageArea().get(STORAGE_KEY);
  return sanitizeSettings(result[STORAGE_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageArea().set({ [STORAGE_KEY]: sanitizeSettings(settings) });
}

export async function loadContextTicker(): Promise<string | null> {
  const result = await chrome.storage.local.get(CONTEXT_TICKER_KEY);
  return typeof result[CONTEXT_TICKER_KEY] === "string" ? result[CONTEXT_TICKER_KEY] : null;
}

export async function saveContextTicker(ticker: string): Promise<void> {
  await chrome.storage.local.set({ [CONTEXT_TICKER_KEY]: ticker });
}

export async function clearContextTicker(): Promise<void> {
  await chrome.storage.local.remove(CONTEXT_TICKER_KEY);
}
