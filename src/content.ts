const API_BASE_URL = "https://api.adanos.org";
const MAX_PAGE_TICKERS = 80;
const MAX_TICKERS_PER_TEXT_NODE = 8;
const TOOLTIP_OFFSET = 14;
const PRODUCT_NAME = "Adanos Market Sentiment";
const SETTINGS_KEYS = ["adanos.marketSentiment.settings", "adanos.sentimentLens.settings"];
const DEFAULT_SOURCE: StockSource = "reddit";
const SKIP_SELECTOR = [
  "button",
  "code",
  "input",
  "option",
  "pre",
  "script",
  "select",
  "style",
  "textarea",
  "[contenteditable='true']",
  ".adanos-ms-ticker",
  ".adanos-ms-tooltip",
].join(",");

const STOCK_SOURCES = {
  reddit: {
    label: "Reddit",
    path: "reddit/stocks/v1",
  },
  x: {
    label: "X / FinTwit",
    path: "x/stocks/v1",
  },
  news: {
    label: "News",
    path: "news/stocks/v1",
  },
  polymarket: {
    label: "Polymarket",
    path: "polymarket/stocks/v1",
  },
} as const;

type StockSource = keyof typeof STOCK_SOURCES;

const STOCK_SOURCE_KEYS = Object.keys(STOCK_SOURCES) as StockSource[];

type Settings = {
  apiKey: string;
  days: number;
  source: StockSource;
};

type SentimentRecord = {
  bullishPct: number | null;
  buzzScore: number | null;
  companyName: string | null;
  mentions: number | null;
  sentimentScore: number | null;
  sourceCount: number | null;
  ticker: string;
  tradeCount: number | null;
  trend: string | null;
  trendHistory: number[];
  uniqueTweets: number | null;
};

type RawSentimentRecord = {
  bullish_pct?: unknown;
  buzz?: unknown;
  buzz_score?: unknown;
  company_name?: unknown;
  mentions?: unknown;
  score?: unknown;
  sentiment?: unknown;
  sentiment_score?: unknown;
  source_count?: unknown;
  symbol?: unknown;
  ticker?: unknown;
  trade_count?: unknown;
  trend?: unknown;
  trend_history?: unknown;
  unique_tweets?: unknown;
};

type TickerMention = {
  end: number;
  start: number;
  ticker: string;
};

type TooltipState = {
  pointerX: number;
  source: StockSource;
  pointerY: number;
  ticker: string;
};

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;
const TICKER_SCAN_PATTERN = /(^|[^A-Za-z0-9.])(\$?[A-Z][A-Z0-9]{0,4}(?:\.[A-Z])?)(?![A-Za-z0-9.])/g;
const EXCLUDED_SCAN_WORDS = new Set([
  "API",
  "CEO",
  "CFO",
  "COO",
  "ETF",
  "GDP",
  "IPO",
  "NYSE",
  "SEC",
  "USD",
  "USA",
  "THE",
  "AND",
  "FOR",
  "FROM",
  "WITH",
]);
const AMBIGUOUS_SCAN_TICKERS = new Set(["AI", "ARE", "CAN", "IT", "ON", "OR", "SO", "TO", "US"]);
const resultCache = new Map<string, Promise<SentimentRecord | null>>();
let settingsPromise: Promise<Settings> | null = null;
let tooltip: HTMLElement | null = null;
let activeState: TooltipState | null = null;
let detectedTickerCount = 0;
let scanTimer: number | null = null;

function isStockSource(value: string): value is StockSource {
  return Object.prototype.hasOwnProperty.call(STOCK_SOURCES, value);
}

function normalizeTicker(input: string): string | null {
  const ticker = input.trim().replace(/^\$/, "").toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) return null;
  return ticker;
}

function isLikelyTicker(rawValue: string, ticker: string): boolean {
  const hasDollarPrefix = rawValue.startsWith("$");
  if (EXCLUDED_SCAN_WORDS.has(ticker)) return false;
  if (!hasDollarPrefix && ticker.length === 1) return false;
  if (!hasDollarPrefix && AMBIGUOUS_SCAN_TICKERS.has(ticker)) return false;
  return true;
}

function findTickerMentions(text: string, limit = 50): TickerMention[] {
  const mentions: TickerMention[] = [];

  for (const match of text.matchAll(TICKER_SCAN_PATTERN)) {
    const prefix = match[1] ?? "";
    const rawValue = match[2] ?? "";
    const ticker = normalizeTicker(rawValue);
    if (!ticker || !isLikelyTicker(rawValue, ticker)) continue;

    const start = (match.index ?? 0) + prefix.length;
    mentions.push({
      end: start + rawValue.length,
      start,
      ticker,
    });

    if (mentions.length >= limit) break;
  }

  return mentions;
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toNumber(item)).filter((item): item is number => item !== null);
}

function normalizeRecord(record: RawSentimentRecord): SentimentRecord | null {
  const ticker = toStringValue(record.ticker) ?? toStringValue(record.symbol);
  if (!ticker) return null;

  return {
    bullishPct: toNumber(record.bullish_pct),
    buzzScore: toNumber(record.buzz_score ?? record.buzz),
    companyName: toStringValue(record.company_name),
    mentions: toNumber(record.mentions),
    sentimentScore: toNumber(record.sentiment_score ?? record.sentiment ?? record.score),
    sourceCount: toNumber(record.source_count),
    ticker: ticker.replace(/^\$/, "").toUpperCase(),
    tradeCount: toNumber(record.trade_count),
    trend: toStringValue(record.trend),
    trendHistory: toNumberArray(record.trend_history),
    uniqueTweets: toNumber(record.unique_tweets),
  };
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") {
    return { apiKey: "", days: 7, source: DEFAULT_SOURCE };
  }

  const candidate = value as Partial<Settings>;
  const days = Number(candidate.days);
  return {
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : "",
    days: Number.isInteger(days) && days >= 1 && days <= 365 ? days : 7,
    source: typeof candidate.source === "string" && isStockSource(candidate.source) ? candidate.source : DEFAULT_SOURCE,
  };
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEYS);
  return sanitizeSettings(result[SETTINGS_KEYS[0]] ?? result[SETTINGS_KEYS[1]]);
}

async function compareSentiment(settings: Settings, ticker: string): Promise<SentimentRecord[]> {
  if (!settings.apiKey.trim()) throw new Error("Add your Adanos API key to continue.");

  const endpoint = new URL(`${API_BASE_URL}/${STOCK_SOURCES[settings.source].path}/compare`);
  endpoint.searchParams.set("tickers", ticker);
  endpoint.searchParams.set("days", String(settings.days));

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "X-API-Key": settings.apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("The Adanos API key was rejected.");
    if (response.status === 403) throw new Error("This API key does not have access to the requested data.");
    if (response.status === 429) throw new Error("Rate limit reached. Try again later.");
    throw new Error(`Adanos API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: RawSentimentRecord[];
    results?: RawSentimentRecord[];
    stocks?: RawSentimentRecord[];
  };
  return (payload.stocks ?? payload.data ?? payload.results ?? [])
    .map((record) => normalizeRecord(record))
    .filter((record): record is SentimentRecord => Boolean(record));
}

function getSettings(): Promise<Settings> {
  settingsPromise ??= loadSettings();
  return settingsPromise;
}

function formatNumber(value: number | null, digits = 0): string {
  if (value === null) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function sourceActivity(record: SentimentRecord, source: StockSource): [string, string] {
  switch (source) {
    case "reddit":
      return ["Mentions", formatNumber(record.mentions, 0)];
    case "x":
      return ["Tweets", formatNumber(record.uniqueTweets, 0)];
    case "news":
      return ["Sources", formatNumber(record.sourceCount, 0)];
    case "polymarket":
      return ["Trades", formatNumber(record.tradeCount, 0)];
  }
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

function trendClass(trend: string | null): string {
  if (trend === "rising") return "rising";
  if (trend === "falling") return "falling";
  if (trend === "stable") return "stable";
  return "unknown";
}

function ensureTooltip(): HTMLElement {
  if (tooltip) return tooltip;
  tooltip = document.createElement("aside");
  tooltip.className = "adanos-ms-tooltip";
  tooltip.setAttribute("role", "status");
  document.documentElement.append(tooltip);
  return tooltip;
}

function moveTooltip(state: TooltipState): void {
  const card = ensureTooltip();
  const width = 280;
  const left = Math.min(window.scrollX + state.pointerX + TOOLTIP_OFFSET, window.scrollX + window.innerWidth - width - 12);
  const top = window.scrollY + state.pointerY + TOOLTIP_OFFSET;
  card.style.left = `${Math.max(12, left)}px`;
  card.style.top = `${Math.max(12, top)}px`;
}

function metric(label: string, value: string, tone = ""): HTMLElement {
  const item = document.createElement("div");
  item.className = "adanos-ms-metric";

  const metricLabel = document.createElement("span");
  metricLabel.className = "adanos-ms-metric-label";
  metricLabel.textContent = label;

  const metricValue = document.createElement("strong");
  metricValue.className = `adanos-ms-metric-value ${tone}`.trim();
  metricValue.textContent = value;

  item.append(metricLabel, metricValue);
  return item;
}

function logoTile(ticker: string): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "adanos-ms-logo";
  tile.textContent = ticker.slice(0, 1);
  return tile;
}

function renderLoading(ticker: string, source: StockSource): void {
  const card = ensureTooltip();
  card.replaceChildren();
  card.classList.add("visible");
  card.append(tooltipHeader(ticker), sourceSwitcher(ticker, source), tooltipBodyText("Loading Adanos sentiment..."));
}

function renderMissingKey(ticker: string, source: StockSource): void {
  const card = ensureTooltip();
  card.replaceChildren();
  card.classList.add("visible");
  card.append(
    tooltipHeader(ticker),
    sourceSwitcher(ticker, source),
    tooltipBodyText("Add your Adanos API key in the extension popup to enable click-to-open ticker sentiment."),
    tooltipFooter(),
  );
}

function renderError(ticker: string, source: StockSource, message: string): void {
  const card = ensureTooltip();
  card.replaceChildren();
  card.classList.add("visible");
  card.append(tooltipHeader(ticker), sourceSwitcher(ticker, source), tooltipBodyText(message), tooltipFooter());
}

function renderSentiment(record: SentimentRecord, source: StockSource): void {
  const card = ensureTooltip();
  const [activityLabel, activityValue] = sourceActivity(record, source);
  const metrics = document.createElement("div");
  metrics.className = "adanos-ms-metrics";
  metrics.append(
    metric("Buzz Score", formatNumber(record.buzzScore, 1)),
    metric("Bullish", record.bullishPct === null ? "-" : `${formatNumber(record.bullishPct, 0)}%`, "positive"),
    metric(activityLabel, activityValue),
    metric("Trend", trendDisplay(record.trend), trendClass(record.trend)),
  );

  card.replaceChildren();
  card.classList.add("visible");
  card.append(
    tooltipHeader(record.ticker, source, record.companyName),
    sourceSwitcher(record.ticker, source),
    metrics,
    trendSparkline(record.trendHistory),
    trendSummary(record, source),
  );
}

function tooltipHeader(ticker: string, source?: StockSource, companyName?: string | null): HTMLElement {
  const header = document.createElement("header");
  header.className = "adanos-ms-tooltip-head";

  const copy = document.createElement("div");
  copy.className = "adanos-ms-title";
  const title = document.createElement("strong");
  title.textContent = ticker;
  const subtitle = document.createElement("span");
  subtitle.textContent = companyName || PRODUCT_NAME;
  copy.append(title, subtitle);

  const left = document.createElement("div");
  left.className = "adanos-ms-title-wrap";
  left.append(logoTile(ticker), copy);

  const label = document.createElement("span");
  label.className = "adanos-ms-source-label";
  label.textContent = source ? `${STOCK_SOURCES[source].label} sentiment` : "Social sentiment";

  header.append(left, label);
  return header;
}

function sourceSwitcher(ticker: string, activeSource: StockSource): HTMLElement {
  const switcher = document.createElement("div");
  switcher.className = "adanos-ms-source-switcher";
  switcher.setAttribute("aria-label", "Sentiment source");

  for (const source of STOCK_SOURCE_KEYS) {
    const button = document.createElement("button");
    button.className = `adanos-ms-source ${source === activeSource ? "active" : ""}`;
    button.type = "button";
    button.textContent = STOCK_SOURCES[source].label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void loadSource(ticker, source);
    });
    switcher.append(button);
  }

  return switcher;
}

function tooltipBodyText(text: string): HTMLElement {
  const body = document.createElement("p");
  body.className = "adanos-ms-body";
  body.textContent = text;
  return body;
}

function trendDisplay(trend: string | null): string {
  if (trend === "falling") return "↓ falling";
  if (trend === "rising") return "↑ rising";
  return trend ?? "-";
}

function trendSparkline(values: number[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "adanos-ms-trendline";

  const label = document.createElement("span");
  label.className = "adanos-ms-section-label";
  label.textContent = "7-day trend";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 356 58");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", sparklinePath(values));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#9b9b9b");
  path.setAttribute("stroke-width", "1.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);

  section.append(label, svg);
  return section;
}

function sparklinePath(values: number[]): string {
  const normalized = values.length >= 2 ? values.slice(-7) : [41, 46, 43, 54, 42, 42.5, 41.8];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;

  return normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 334 + 11;
      const y = 48 - ((value - min) / range) * 34;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function trendSummary(record: SentimentRecord, source: StockSource): HTMLElement {
  const section = document.createElement("section");
  section.className = "adanos-ms-summary";

  const label = document.createElement("span");
  label.className = "adanos-ms-section-label";
  label.textContent = "Trend summary";

  const text = document.createElement("p");
  text.textContent = `${STOCK_SOURCES[source].label} sentiment for ${record.ticker} is currently ${sentimentSummary(
    record.sentimentScore,
  )} with ${sourceActivitySummary(record, source)} ${sourceContextSummary(source)}. Buzz is ${formatNumber(
    record.buzzScore,
    1,
  )} and momentum is ${record.trend ?? "not available"}.`;

  const footer = tooltipFooter();
  section.append(label, text, footer);
  return section;
}

function tooltipFooter(): HTMLElement {
  const footer = document.createElement("a");
  footer.className = "adanos-ms-footer";
  footer.href = "https://adanos.org";
  footer.target = "_blank";
  footer.rel = "noreferrer";
  footer.textContent = "Powered by Adanos";
  return footer;
}

function hideTooltip(): void {
  activeState = null;
  tooltip?.classList.remove("visible");
}

function hideTooltipOnOutsideClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (tooltip?.contains(target)) return;
  if ((target as Element).closest?.(".adanos-ms-ticker")) return;
  hideTooltip();
}

function fetchTicker(settings: Settings, ticker: string): Promise<SentimentRecord | null> {
  const cacheKey = `${settings.source}:${settings.days}:${ticker}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const request = compareSentiment(settings, ticker).then((results) => results[0] ?? null);

  resultCache.set(cacheKey, request);
  return request;
}

async function loadSource(ticker: string, source: StockSource): Promise<void> {
  const baseSettings = await getSettings();
  const settings = { ...baseSettings, source };

  if (activeState) activeState.source = source;

  if (!settings.apiKey) {
    renderMissingKey(ticker, source);
    return;
  }

  renderLoading(ticker, source);

  try {
    const record = await fetchTicker(settings, ticker);
    if (!activeState || activeState.ticker !== ticker || activeState.source !== source) return;
    if (!record) {
      renderError(ticker, source, "No sentiment data found for this ticker.");
      return;
    }
    renderSentiment(record, source);
  } catch (error) {
    if (!activeState || activeState.ticker !== ticker || activeState.source !== source) return;
    renderError(ticker, source, error instanceof Error ? error.message : "Unable to load sentiment.");
  }
}

async function showTooltip(ticker: string, pointerX: number, pointerY: number): Promise<void> {
  const settings = await getSettings();
  activeState = { pointerX, pointerY, source: settings.source, ticker };
  moveTooltip(activeState);
  await loadSource(ticker, settings.source);
}

function wrapTextNode(textNode: Text, remaining: { count: number }): void {
  const text = textNode.nodeValue ?? "";
  const mentions = findTickerMentions(text, MAX_TICKERS_PER_TEXT_NODE);
  if (!mentions.length) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const mention of mentions) {
    if (remaining.count <= 0) break;
    fragment.append(text.slice(cursor, mention.start));

    const tickerNode = document.createElement("span");
    tickerNode.className = "adanos-ms-ticker";
    tickerNode.dataset.ticker = mention.ticker;
    tickerNode.tabIndex = 0;
    tickerNode.title = `Click for ${mention.ticker} sentiment`;
    tickerNode.textContent = text.slice(mention.start, mention.end);
    tickerNode.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void showTooltip(mention.ticker, event.clientX, event.clientY);
    });
    tickerNode.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const rect = tickerNode.getBoundingClientRect();
      void showTooltip(mention.ticker, rect.left, rect.bottom);
    });
    fragment.append(tickerNode);

    cursor = mention.end;
    remaining.count -= 1;
    detectedTickerCount += 1;
  }

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);
}

function shouldSkipTextNode(textNode: Text): boolean {
  const parent = textNode.parentElement;
  if (!parent || parent.closest(SKIP_SELECTOR)) return true;
  const text = textNode.nodeValue ?? "";
  return text.trim().length < 2;
}

function scanPage(): void {
  if (!document.body || detectedTickerCount >= MAX_PAGE_TICKERS) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (shouldSkipTextNode(node as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  const remaining = { count: MAX_PAGE_TICKERS - detectedTickerCount };
  for (const textNode of textNodes) {
    if (remaining.count <= 0) break;
    wrapTextNode(textNode, remaining);
  }
}

function scheduleScan(): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    scanPage();
  }, 500);
}

scanPage();

if (document.body) {
  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleScan();
  }).observe(document.body, { childList: true, subtree: true });
}

document.addEventListener("click", hideTooltipOnOutsideClick, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideTooltip();
});
