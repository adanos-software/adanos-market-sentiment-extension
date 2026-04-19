import { beforeEach, describe, expect, it, vi } from "vitest";

const localStore = new Map<string, unknown>();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: localStore.get(key) })),
      remove: vi.fn(async (key: string) => localStore.delete(key)),
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
      source: "news",
      watchlist: ["NVDA", "TSLA", "AAPL"],
    });
  });

  it("sanitizes invalid stored settings", async () => {
    const { loadSettings } = await import("../src/storage");
    localStore.set("adanos.sentimentLens.settings", {
      apiKey: "sk_live_test",
      days: 999,
      source: "commodities",
      watchlist: ["NVDA", 42],
    });

    await expect(loadSettings()).resolves.toMatchObject({
      apiKey: "sk_live_test",
      days: 7,
      source: "news",
      watchlist: ["NVDA"],
    });
  });
});
