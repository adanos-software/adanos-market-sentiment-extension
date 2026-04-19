# Chrome Web Store Submission Notes

## Listing

Name: Adanos Market Sentiment

Short description:

> Instant stock market sentiment from Reddit, X, News and Polymarket for selected tickers.

Single purpose:

> Show stock market sentiment for selected tickers while browsing.

## Long Description Draft

Adanos Market Sentiment helps investors, analysts, and market researchers check
stock sentiment directly from Chrome.

Highlight a ticker such as `NVDA`, `TSLA`, or `$AAPL`, right-click, and choose
`Check Adanos sentiment`. You can also enable ticker detection on the current
page from the extension popup; detected stock tickers show a Stock Sentiment
Card-style preview after click. You can open the extension popup and compare a
watchlist of up to 10 stock tickers.

Supported sentiment sources:

- Reddit
- X / FinTwit
- News
- Polymarket

The extension shows sentiment score, buzz score, bullish ratio, source-specific
activity metrics, and trend when available from the Adanos Market Sentiment API.

Your Adanos API key is stored locally in Chrome local storage and is only sent to
`https://api.adanos.org` when you request a sentiment lookup.

Learn more: https://adanos.org

API docs: https://api.adanos.org/docs/

Disclaimer: This extension provides market sentiment data for research purposes
only. It is not financial advice.

## Store URLs

- Developer website: https://adanos.org
- Privacy policy: https://adanos.org/privacy
- Support URL: https://adanos.org/contact

## Screenshot Assets

Chrome Web Store screenshots are prepared as 1280x800 PNG files:

- `output/playwright/screenshots/01-popup-watchlist.png`
- `output/playwright/screenshots/02-click-ticker-overlay.png`
- `output/playwright/screenshots/03-source-switcher.png`
- `output/playwright/screenshots/04-easy-setup.png`
- `output/playwright/screenshots/05-privacy-permissions.png`

## Permissions Justification

- `storage`: saves the API key, source preference, analysis period, and watchlist.
- `contextMenus`: adds the right-click ticker lookup action for selected text.
- `activeTab`: allows ticker detection to run on the current tab only after the
  user explicitly clicks "Enable ticker detection on this page" in the popup.
- `scripting`: injects the packaged content script and stylesheet into the
  current active tab after that explicit user action.
- `https://api.adanos.org/*`: calls the Adanos Market Sentiment API.

## Review Guardrails

- Manifest V3 only.
- No remote JavaScript.
- No analytics.
- No browsing-history permission.
- No broad API host permission beyond `https://api.adanos.org/*`.
- No broad webpage host permission; page detection uses `activeTab` after
  explicit user action.
- No ad injection.
- No page-content collection; ticker detection runs locally and only clicked
  ticker symbols are sent to the API.
