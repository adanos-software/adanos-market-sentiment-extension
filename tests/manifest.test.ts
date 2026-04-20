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
      }> | undefined;
      host_permissions: string[];
      name: string;
      permissions: string[];
      short_name: string;
      version: string;
    };

    expect(manifest.name).toBe("Adanos Market Sentiment");
    expect(manifest.short_name).toBe("Adanos MS");
    expect(manifest.version).toBe("1.0.2");
    expect(manifest.permissions).toEqual(["storage", "contextMenus", "activeTab", "scripting"]);
    expect(manifest.host_permissions).toEqual(["https://api.adanos.org/*"]);
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("injects page ticker detection only after explicit user action", () => {
    const popupScript = readFileSync(resolve("src/popup.ts"), "utf8");

    expect(popupScript).toContain('["content.css"]');
    expect(popupScript).toContain('["content.js"]');
    expect(popupScript).toContain("chrome.scripting.insertCSS");
    expect(popupScript).toContain("chrome.scripting.executeScript");
    expect(popupScript).toContain("Enable ticker detection on this page");
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
    expect(contentScript).toContain("adanosMarketSentimentLoaded");
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

    expect(popupScript).toContain('class: "brand-mark"');
    expect(popupScript).toContain('src: "icons/icon-32.png"');
    expect(popupScript).toContain('class: "sentiment-card"');
    expect(popupScript).toContain('class: "trendline"');
    expect(popupScript).toContain('class: "sentiment-summary"');
    expect(popupStyles).toContain(".sentiment-card");
    expect(popupStyles).toContain("background: #fff");
    expect(popupStyles).toContain("--c-red: #c62828");
    expect(popupStyles).not.toContain("--c-terminal");
    expect(popupStyles).not.toContain('content: "●  ●  ●"');
  });

  it("uses the Adanos candlestick mark for extension icons", () => {
    const iconSvg = readFileSync(resolve("assets/icon.svg"), "utf8");

    expect(iconSvg).toContain('fill="#1A1A1A"');
    expect(iconSvg).toContain('fill="#2E7D32"');
    expect(iconSvg).toContain('fill="#C62828"');
    expect(iconSvg).not.toContain(">A<");
  });
});
