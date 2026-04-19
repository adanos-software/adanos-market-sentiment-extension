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

  it("keeps the ticker card branded and source-switchable", () => {
    const contentScript = readFileSync(resolve("src/content.ts"), "utf8");
    const contentStyles = readFileSync(resolve("public/content.css"), "utf8");

    expect(contentScript).toContain('tickerNode.addEventListener("click"');
    expect(contentScript).not.toContain('tickerNode.addEventListener("mouseenter"');
    expect(contentScript).toContain("function sourceSwitcher");
    expect(contentStyles).toContain(".adanos-ms-source-switcher");
    expect(contentStyles).toContain(".adanos-ms-trendline");
    expect(contentStyles).toContain(".adanos-ms-summary");
    expect(contentStyles).toContain(".adanos-ms-metric-value.falling");
    expect(contentStyles).toContain("background-size: 100% 1px");
    expect(contentStyles).toContain("text-decoration: none");
    expect(contentStyles).not.toContain("border-bottom: 1px dotted");
    expect(contentStyles).not.toContain('content: "●  ●  ●"');
  });

  it("keeps the popup on the light Adanos card system", () => {
    const popupScript = readFileSync(resolve("src/popup.ts"), "utf8");
    const popupStyles = readFileSync(resolve("src/styles.css"), "utf8");

    expect(popupScript).toContain('class: "sentiment-card"');
    expect(popupScript).toContain('class: "trendline"');
    expect(popupScript).toContain('class: "sentiment-summary"');
    expect(popupStyles).toContain(".sentiment-card");
    expect(popupStyles).toContain("background: #fff");
    expect(popupStyles).toContain("--c-red: #e11936");
    expect(popupStyles).not.toContain("--c-terminal");
    expect(popupStyles).not.toContain('content: "●  ●  ●"');
  });
});
