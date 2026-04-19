import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { STOCK_SOURCES } from "../src/sources";

describe("Chrome Web Store scope", () => {
  it("keeps extension permissions narrow", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8")) as {
      host_permissions: string[];
      permissions: string[];
    };

    expect(manifest.permissions).toEqual(["storage", "contextMenus"]);
    expect(manifest.host_permissions).toEqual(["https://api.adanos.org/*"]);
  });

  it("only exposes the four stock sentiment sources", () => {
    expect(Object.keys(STOCK_SOURCES)).toEqual(["news", "reddit", "x", "polymarket"]);
    expect(Object.values(STOCK_SOURCES).map((source) => source.path)).toEqual([
      "news/stocks/v1",
      "reddit/stocks/v1",
      "x/stocks/v1",
      "polymarket/stocks/v1",
    ]);
  });
});

