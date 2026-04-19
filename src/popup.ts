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

function sourceMetric(record: SentimentRecord, source: StockSource): HTMLElement {
  switch (source) {
    case "news":
      return popupMetric("Sources", formatNumber(record.sourceCount, 0));
    case "reddit":
      return popupMetric("Mentions", formatNumber(record.mentions, 0));
    case "x":
      return popupMetric("Tweets", formatNumber(record.uniqueTweets, 0));
    case "polymarket":
      return popupMetric("Trades", formatNumber(record.tradeCount, 0));
  }
}

function resultCard(record: SentimentRecord, source: StockSource): HTMLElement {
  const tone = sentimentTone(record.sentimentScore);

  return el("section", { class: "sentiment-card" }, [
    el("header", { class: "sentiment-head" }, [
      el("div", { class: "sentiment-title-wrap" }, [
        el("div", { class: "brand-tile" }, [record.ticker.slice(0, 1)]),
        el("div", { class: "sentiment-title" }, [
          el("strong", {}, [record.ticker]),
          el("span", {}, [record.companyName ?? "Market sentiment snapshot"]),
        ]),
      ]),
      el("span", { class: "source-label" }, [`${STOCK_SOURCES[source].label} sentiment`]),
    ]),
    el("div", { class: "sentiment-metrics" }, [
      popupMetric("Buzz Score", formatNumber(record.buzzScore, 1)),
      popupMetric("Bullish", record.bullishPct === null ? "-" : `${formatNumber(record.bullishPct, 0)}%`, tone),
      sourceMetric(record, source),
      popupMetric("Trend", trendDisplay(record.trend), trendClass(record.trend)),
    ]),
    trendSparkline(record.trendHistory),
    el("section", { class: "sentiment-summary" }, [
      el("span", { class: "section-label" }, ["Trend summary"]),
      el("p", {}, [summaryText(record, source)]),
    ]),
  ]);
}

function popupMetric(label: string, value: string, tone = ""): HTMLElement {
  return el("div", { class: "sentiment-metric" }, [
    el("span", { class: "metric-label" }, [label]),
    el("strong", { class: `metric-value ${tone}`.trim() }, [value]),
  ]);
}

function trendDisplay(trend: string | null): string {
  if (trend === "falling") return "↓ falling";
  if (trend === "rising") return "↑ rising";
  return trend ?? "-";
}

function trendClass(trend: string | null): string {
  if (trend === "rising") return "rising";
  if (trend === "falling") return "falling";
  if (trend === "stable") return "stable";
  return "unknown";
}

function trendSparkline(values: number[]): HTMLElement {
  const normalized = values.length >= 2 ? values.slice(-7) : [41, 46, 43, 54, 42, 42.5, 41.8];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;
  const path = normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 334 + 11;
      const y = 48 - ((value - min) / range) * 34;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const section = el("section", { class: "trendline" }, [el("span", { class: "section-label" }, ["7-day trend"])]);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 356 58");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", path);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#9b9b9b");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-width", "1.2");
  svg.append(line);
  section.append(svg);
  return section;
}

function summaryText(record: SentimentRecord, source: StockSource): string {
  return `${STOCK_SOURCES[source].label} sentiment for ${record.ticker} is currently ${sentimentSummary(
    record.sentimentScore,
  )} with ${sourceActivitySummary(record, source)} ${sourceContextSummary(source)}. Buzz is ${formatNumber(
    record.buzzScore,
    1,
  )} and momentum is ${record.trend ?? "not available"}.`;
}

function sourceActivitySummary(record: SentimentRecord, source: StockSource): string {
  switch (source) {
    case "reddit":
      return `${formatNumber(record.mentions, 0)} mentions`;
    case "x":
      return `${formatNumber(record.uniqueTweets, 0)} tweets`;
    case "news":
      return `${formatNumber(record.sourceCount, 0)} sources`;
    case "polymarket":
      return `${formatNumber(record.tradeCount, 0)} trades`;
  }
}

function sourceContextSummary(source: StockSource): string {
  switch (source) {
    case "reddit":
      return "across Reddit communities";
    case "x":
      return "across X / FinTwit";
    case "news":
      return "across market news sources";
    case "polymarket":
      return "across Polymarket stock markets";
  }
}

function sentimentSummary(value: number | null): string {
  if (value === null) return "mixed";
  if (value > 0.05) return "bullish";
  if (value < -0.05) return "bearish";
  return "neutral";
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
        el("img", { alt: "", class: "brand-mark", height: "32", src: "icons/icon-32.png", width: "32" }),
        el("div", {}, [el("p", { class: "eyebrow" }, ["Real-time market sentiment API"]), el("h1", {}, [PRODUCT_NAME])]),
      ]),
      state.settings.apiKey
        ? el("p", { class: "muted" }, ["Check stock sentiment across Reddit, X, News, and Polymarket with one Adanos API key."])
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
