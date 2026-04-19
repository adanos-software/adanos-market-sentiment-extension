import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_SOURCE, STOCK_SOURCES } from "../src/sources";

describe("Chrome Web Store scope", () => {
  it("keeps extension permissions narrow", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8")) as {
      content_scripts: Array<{
        css: string[];
        exclude_matches: string[];
        js: string[];
        matches: string[];
        run_at: string;
      }>;
      host_permissions: string[];
      name: string;
      permissions: string[];
      short_name: string;
    };

    expect(manifest.name).toBe("Adanos Market Sentiment");
    expect(manifest.short_name).toBe("Adanos MS");
    expect(manifest.permissions).toEqual(["storage", "contextMenus"]);
    expect(manifest.host_permissions).toEqual(["https://api.adanos.org/*"]);
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["http://*/*", "https://*/*"],
        exclude_matches: ["https://api.adanos.org/*", "https://adanos.org/*"],
        js: ["content.js"],
        css: ["content.css"],
        run_at: "document_idle",
      },
    ]);
  });

  it("uses Reddit, X, News, Polymarket as the source order", () => {
    expect(DEFAULT_SOURCE).toBe("reddit");
    expect(Object.keys(STOCK_SOURCES)).toEqual(["reddit", "x", "news", "polymarket"]);
    expect(Object.values(STOCK_SOURCES).map((source) => source.path)).toEqual([
      "reddit/stocks/v1",
      "x/stocks/v1",
      "news/stocks/v1",
      "polymarket/stocks/v1",
    ]);
  });

  it("keeps the content script self-contained for Chrome MV3", () => {
    const contentScript = readFileSync(resolve("src/content.ts"), "utf8");

    expect(contentScript).not.toMatch(/^import\s/m);
    expect(contentScript).not.toMatch(/^export\s/m);
  });
});
