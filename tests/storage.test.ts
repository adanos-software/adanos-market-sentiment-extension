import { beforeEach, describe, expect, it, vi } from "vitest";

const localStore = new Map<string, unknown>();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, localStore.get(key)]));
        }

        return { [keys]: localStore.get(keys) };
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => localStore.delete(key));
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.entries(items).forEach(([key, value]) => localStore.set(key, value));
      }),
    },
  },
});

describe("settings storage", () => {
  beforeEach(() => {
    localStore.clear();
  });

  it("loads defaults when no settings are stored", async () => {
    const { loadSettings } = await import("../src/storage");

    await expect(loadSettings()).resolves.toMatchObject({
      days: 7,
      source: "reddit",
      watchlist: ["NVDA", "TSLA", "AAPL"],
    });
  });

  it("sanitizes invalid stored settings", async () => {
    const { loadSettings } = await import("../src/storage");
    localStore.set("adanos.marketSentiment.settings", {
      apiKey: "sk_live_test",
      days: 999,
      source: "commodities",
      watchlist: ["NVDA", 42],
    });

    await expect(loadSettings()).resolves.toMatchObject({
      apiKey: "sk_live_test",
      days: 7,
      source: "reddit",
      watchlist: ["NVDA"],
    });
  });

  it("migrates legacy settings", async () => {
    const { loadSettings } = await import("../src/storage");
    localStore.set("adanos.sentimentLens.settings", {
      apiKey: "sk_live_legacy",
      days: 14,
      source: "reddit",
      watchlist: ["TSLA"],
    });

    await expect(loadSettings()).resolves.toMatchObject({
      apiKey: "sk_live_legacy",
      days: 14,
      source: "reddit",
      watchlist: ["TSLA"],
    });
    expect(localStore.has("adanos.sentimentLens.settings")).toBe(false);
    expect(localStore.get("adanos.marketSentiment.settings")).toMatchObject({
      apiKey: "sk_live_legacy",
    });
  });

  it("reads and clears legacy context tickers", async () => {
    const { clearContextTicker, loadContextTicker } = await import("../src/storage");
    localStore.set("adanos.sentimentLens.contextTicker", "NVDA");

    await expect(loadContextTicker()).resolves.toBe("NVDA");
    await clearContextTicker();

    expect(localStore.has("adanos.sentimentLens.contextTicker")).toBe(false);
    expect(localStore.has("adanos.marketSentiment.contextTicker")).toBe(false);
  });
});
