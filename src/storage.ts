import { DEFAULT_SOURCE, isStockSource, type StockSource } from "./sources";

const LEGACY_CONTEXT_TICKER_KEY = "adanos.sentimentLens.contextTicker";
const LEGACY_STORAGE_KEY = "adanos.sentimentLens.settings";
const CONTEXT_TICKER_KEY = "adanos.marketSentiment.contextTicker";
const STORAGE_KEY = "adanos.marketSentiment.settings";

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
  const result = await storageArea().get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const settings = sanitizeSettings(result[STORAGE_KEY] ?? result[LEGACY_STORAGE_KEY]);

  if (!result[STORAGE_KEY] && result[LEGACY_STORAGE_KEY]) {
    await saveSettings(settings);
    await storageArea().remove(LEGACY_STORAGE_KEY);
  }

  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageArea().set({ [STORAGE_KEY]: sanitizeSettings(settings) });
}

export async function loadContextTicker(): Promise<string | null> {
  const result = await storageArea().get([CONTEXT_TICKER_KEY, LEGACY_CONTEXT_TICKER_KEY]);
  const ticker = result[CONTEXT_TICKER_KEY] ?? result[LEGACY_CONTEXT_TICKER_KEY];
  return typeof ticker === "string" ? ticker : null;
}

export async function saveContextTicker(ticker: string): Promise<void> {
  await storageArea().set({ [CONTEXT_TICKER_KEY]: ticker });
}

export async function clearContextTicker(): Promise<void> {
  await storageArea().remove([CONTEXT_TICKER_KEY, LEGACY_CONTEXT_TICKER_KEY]);
}
