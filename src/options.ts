import "./styles.css";

import { PRODUCT_NAME } from "./branding";
import { el } from "./dom";
import { STOCK_SOURCES, type StockSource } from "./sources";
import { loadSettings, saveSettings, type Settings } from "./storage";
import { parseTickerList } from "./tickers";

const app = document.querySelector<HTMLElement>("#app");

function render(settings: Settings, message = ""): void {
  if (!app) return;

  const apiKey = el("input", {
    autocomplete: "off",
    class: "input",
    placeholder: "sk_live_...",
    type: "password",
    value: settings.apiKey,
  });
  const days = el("input", {
    class: "input",
    max: "365",
    min: "1",
    type: "number",
    value: String(settings.days),
  });
  const watchlist = el("input", {
    class: "input",
    placeholder: "NVDA, TSLA, AAPL",
    type: "text",
    value: settings.watchlist.join(", "),
  });
  const source = el(
    "select",
    { class: "select" },
    Object.entries(STOCK_SOURCES).map(([value, meta]) => {
      const option = el("option", { value }, [meta.label]);
      if (value === settings.source) option.setAttribute("selected", "selected");
      return option;
    }),
  );

  const save = el("button", { class: "button", type: "button" }, ["Save settings"]);
  save.addEventListener("click", async () => {
    const next: Settings = {
      apiKey: apiKey.value.trim(),
      days: Math.min(365, Math.max(1, Number(days.value) || 7)),
      onboardingComplete: true,
      source: source.value as StockSource,
      watchlist: parseTickerList(watchlist.value),
    };
    await saveSettings(next);
    render(next, "Settings saved.");
  });

  app.replaceChildren(
    el("div", { class: "shell" }, [
      el("header", { class: "brand" }, [
        el("div", {}, [el("p", { class: "eyebrow" }, [PRODUCT_NAME]), el("h1", {}, ["Settings"])]),
      ]),
      el("section", { class: "card stack" }, [
        el("label", { class: "label" }, ["Adanos API key"]),
        apiKey,
        el("label", { class: "label" }, ["Default source"]),
        source,
        el("label", { class: "label" }, ["Default period in days"]),
        days,
        el("label", { class: "label" }, ["Default stock watchlist"]),
        watchlist,
        save,
        message ? el("div", { class: "alert" }, [message]) : el("div", { class: "hidden" }),
      ]),
      el("footer", { class: "footer" }, [
        el("a", { href: "https://adanos.org", target: "_blank", rel: "noreferrer" }, ["Get API key"]),
        el("a", { href: "https://api.adanos.org/docs/", target: "_blank", rel: "noreferrer" }, ["API docs"]),
        el("a", { href: "https://adanos.org/privacy", target: "_blank", rel: "noreferrer" }, ["Privacy"]),
      ]),
    ]),
  );
}

void loadSettings().then((settings) => render(settings));
