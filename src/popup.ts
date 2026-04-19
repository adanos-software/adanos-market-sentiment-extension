import "./styles.css";

import { compareSentiment, type SentimentRecord } from "./api";
import { PRODUCT_NAME } from "./branding";
import { el, formatNumber, sentimentTone } from "./dom";
import { STOCK_SOURCES, type StockSource } from "./sources";
import { clearContextTicker, loadContextTicker, loadSettings, saveSettings, type Settings } from "./storage";
import { MAX_COMPARE_TICKERS, parseTickerList } from "./tickers";

type State = {
  error: string | null;
  loading: boolean;
  results: SentimentRecord[];
  settings: Settings;
  tickerInput: string;
};

const app = document.querySelector<HTMLElement>("#app");

function withClick<T extends HTMLElement>(node: T, callback: () => void | Promise<void>): T {
  node.addEventListener("click", () => {
    void callback();
  });
  return node;
}

function sourceButtons(state: State, render: (next: State) => void): HTMLElement {
  return el(
    "div",
    { class: "pill-row", "aria-label": "Sentiment source" },
    Object.entries(STOCK_SOURCES).map(([source, meta]) =>
      withClick(
        el(
          "button",
          {
            class: `pill ${state.settings.source === source ? "active" : ""}`,
            type: "button",
          },
          [meta.label],
        ),
        async () => {
          const settings = { ...state.settings, source: source as StockSource };
          await saveSettings(settings);
          render({ ...state, settings });
        },
      ),
    ),
  );
}

function sourceMetrics(record: SentimentRecord, source: StockSource): HTMLElement[] {
  switch (source) {
    case "news":
      return [
        metric("Mentions", formatNumber(record.mentions, 0), "neutral"),
        metric("Sources", formatNumber(record.sourceCount, 0), "neutral"),
      ];
    case "reddit":
      return [
        metric("Mentions", formatNumber(record.mentions, 0), "neutral"),
        metric("Subreddits", formatNumber(record.subredditCount, 0), "neutral"),
      ];
    case "x":
      return [
        metric("Mentions", formatNumber(record.mentions, 0), "neutral"),
        metric("Tweets", formatNumber(record.uniqueTweets, 0), "neutral"),
      ];
    case "polymarket":
      return [
        metric("Trades", formatNumber(record.tradeCount, 0), "neutral"),
        metric("Liquidity", formatNumber(record.totalLiquidity, 0), "neutral"),
      ];
  }
}

function resultCard(record: SentimentRecord, source: StockSource): HTMLElement {
  const tone = sentimentTone(record.sentimentScore);

  return el("section", { class: "card result" }, [
    el("div", { class: "result-head" }, [
      el("div", {}, [
        el("div", { class: "ticker" }, [record.ticker]),
        el("p", { class: "muted" }, [record.companyName ?? "Market sentiment snapshot"]),
      ]),
      el("span", { class: "trend" }, [record.trend ?? "n/a"]),
    ]),
    el("div", { class: "metrics" }, [
      metric("Sentiment", formatNumber(record.sentimentScore, 2), tone),
      metric("Buzz", formatNumber(record.buzzScore, 0), "positive"),
      ...sourceMetrics(record, source),
      metric("Bull / Bear", `${formatNumber(record.bullishPct, 0)} / ${formatNumber(record.bearishPct, 0)}`, tone),
    ]),
  ]);
}

function metric(label: string, value: string, tone: "positive" | "negative" | "neutral"): HTMLElement {
  return el("div", { class: "metric" }, [el("div", { class: "label" }, [label]), el("div", { class: `value ${tone}` }, [value])]);
}

function footer(): HTMLElement {
  return el("footer", { class: "footer" }, [
    el("a", { href: "https://adanos.org", target: "_blank", rel: "noreferrer" }, ["Powered by Adanos"]),
    el("a", { href: "https://api.adanos.org/docs/", target: "_blank", rel: "noreferrer" }, ["API docs"]),
    el("a", { href: "options.html", target: "_blank" }, ["Settings"]),
  ]);
}

function render(state: State): void {
  if (!app) return;

  app.replaceChildren(
    el("div", { class: "shell" }, [
      el("header", { class: "brand" }, [
        el("div", {}, [el("p", { class: "eyebrow" }, ["Real-time market sentiment API"]), el("h1", {}, [PRODUCT_NAME])]),
      ]),
      state.settings.apiKey
        ? el("p", { class: "muted" }, ["Check stock sentiment across News, Reddit, X, and Polymarket with one Adanos API key."])
        : el("section", { class: "card stack" }, [
            el("p", { class: "eyebrow" }, ["Quick setup"]),
            el("h2", {}, ["Add your Adanos API key"]),
            el("p", { class: "muted" }, ["Your key stays in Chrome storage and is only sent to api.adanos.org for sentiment requests."]),
            apiKeyForm(state, render),
          ]),
      sourceButtons(state, render),
      searchForm(state, render),
      state.error ? el("div", { class: "alert" }, [state.error]) : el("div", { class: "hidden" }),
      state.loading ? el("section", { class: "card muted" }, ["Loading Adanos sentiment..."]) : el("div", { class: "hidden" }),
      el("div", { class: "stack" }, state.results.map((record) => resultCard(record, state.settings.source))),
      footer(),
    ]),
  );
}

function apiKeyForm(state: State, render: (next: State) => void): HTMLElement {
  const input = el("input", {
    autocomplete: "off",
    class: "input",
    placeholder: "sk_live_...",
    type: "password",
    value: state.settings.apiKey,
  });
  const button = el("button", { class: "button", type: "button" }, ["Save"]);
  button.addEventListener("click", async () => {
    const settings = { ...state.settings, apiKey: input.value.trim(), onboardingComplete: true };
    await saveSettings(settings);
    render({ ...state, settings });
  });
  return el("div", { class: "form-row" }, [input, button]);
}

function searchForm(state: State, render: (next: State) => void): HTMLElement {
  const input = el("input", {
    class: "input",
    placeholder: `NVDA, TSLA, AAPL (max ${MAX_COMPARE_TICKERS})`,
    type: "text",
    value: state.tickerInput,
  });
  const button = el("button", { class: "button", type: "submit" }, [state.loading ? "Checking" : "Check"]);
  const form = el("form", { class: "card stack" }, [
    el("p", { class: "eyebrow" }, [STOCK_SOURCES[state.settings.source].label]),
    el("p", { class: "muted" }, [STOCK_SOURCES[state.settings.source].summary]),
    el("div", { class: "form-row" }, [input, button]),
  ]);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tickers = parseTickerList(input.value);
    const tickerInput = tickers.join(", ");

    if (!state.settings.apiKey) {
      render({ ...state, error: "Add your Adanos API key before checking sentiment.", tickerInput });
      return;
    }

    if (!tickers.length) {
      render({ ...state, error: "Enter at least one valid stock ticker.", tickerInput });
      return;
    }

    render({ ...state, error: null, loading: true, tickerInput });
    try {
      const results = await compareSentiment({
        apiKey: state.settings.apiKey,
        days: state.settings.days,
        source: state.settings.source,
        tickers,
      });
      const settings = { ...state.settings, watchlist: tickers };
      await saveSettings(settings);
      render({ ...state, error: null, loading: false, results, settings, tickerInput });
    } catch (error) {
      render({ ...state, error: error instanceof Error ? error.message : "Unknown error", loading: false, tickerInput });
    }
  });

  return form;
}

async function boot(): Promise<void> {
  const settings = await loadSettings();
  const contextTicker = await loadContextTicker();
  if (contextTicker) await clearContextTicker();

  const tickerInput = contextTicker ?? settings.watchlist.join(", ");
  const state: State = {
    error: null,
    loading: false,
    results: [],
    settings,
    tickerInput,
  };

  render(state);
}

void boot();
